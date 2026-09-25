import { Router, raw, type IRouter } from "express";
import { classAssignmentKey, currentUserFromToken, findStudentByPhotoPath, listOperation } from "../lib/school-data";
import { isPupilPhotoPath, MAX_UPLOAD_BYTES, requestObjectDownload, uploadPupilPhoto } from "../lib/object-storage";

const router: IRouter = Router();
const getSession = (req: Parameters<Parameters<IRouter["get"]>[1]>[0]) =>
  req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith("schoolops_session="))?.slice("schoolops_session=".length);

router.post("/storage/uploads/request-url", (_req, res): void => {
  res.status(410).json({ error: "Direct uploads are disabled. Upload image bytes to /api/storage/photos." });
});

const isValidImage = (bytes: Buffer, type: string) => {
  if (type === "image/jpeg") return bytes.length >= 4 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]));
  if (type === "image/png") return bytes.length >= 20 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.subarray(-12).equals(Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]));
  if (type === "image/webp") return bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length;
  return false;
};

router.post("/storage/photos", async (req, res, next): Promise<void> => {
  const user = await currentUserFromToken(getSession(req));
  if (!user || !["administrator", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Only administrators can upload pupil photos." });
    return;
  }
  next();
}, raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: MAX_UPLOAD_BYTES }), async (req, res): Promise<void> => {
  const contentType = req.get("content-type")?.toLowerCase();
  if (!Buffer.isBuffer(req.body) || !contentType || req.body.length < 1 || req.body.length >= MAX_UPLOAD_BYTES || !isValidImage(req.body, contentType)) {
    res.status(400).json({ error: "Choose a valid JPEG, PNG, or WebP image smaller than 1 MB." });
    return;
  }
  try {
    res.json({ objectPath: await uploadPupilPhoto(req.body, contentType) });
  } catch (error) {
    req.log.error({ error }, "Pupil photo upload failed");
    res.status(502).json({ error: "The image could not be saved. Please try again." });
  }
});

router.get("/storage/objects/*path", async (req, res): Promise<void> => {
  const user = await currentUserFromToken(getSession(req));
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  const rawPath = req.params.path;
  const objectPath = `/objects/${Array.isArray(rawPath) ? rawPath.join("/") : rawPath}`;
  if (!isPupilPhotoPath(objectPath)) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  const student = await findStudentByPhotoPath(objectPath);
  if (!student) {
    res.status(404).json({ error: "Object not found" });
    return;
  }
  if (!["administrator", "super_admin", "secretary"].includes(user.role) && user.studentId !== student.id) {
    if (user.role !== "teacher") {
      res.status(403).json({ error: "You do not have access to this pupil photo." });
      return;
    }
    const classes = await listOperation("classes");
    const assigned = classes.some((item) => item.teacherId === user.id &&
      classAssignmentKey(String(item.name), String(item.stream ?? "")) === classAssignmentKey(student.className, student.stream));
    if (!assigned) {
      res.status(403).json({ error: "You do not have access to this pupil photo." });
      return;
    }
  }
  try {
    res.redirect(302, await requestObjectDownload(objectPath));
  } catch {
    res.status(404).json({ error: "Object not found" });
  }
});

export default router;