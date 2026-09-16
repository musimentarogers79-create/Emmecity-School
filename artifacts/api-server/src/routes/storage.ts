import { Router, type IRouter } from "express";
import { currentUserFromToken } from "../lib/school-data";
import { isPupilPhotoPath, MAX_UPLOAD_BYTES, requestObjectDownload, requestPupilPhotoUpload } from "../lib/object-storage";

const router: IRouter = Router();
const getSession = (req: Parameters<Parameters<IRouter["get"]>[1]>[0]) =>
  req.headers.cookie?.split(";").map((value) => value.trim()).find((value) => value.startsWith("schoolops_session="))?.slice("schoolops_session=".length);

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const user = await currentUserFromToken(getSession(req));
  if (!user || !["administrator", "super_admin"].includes(user.role)) {
    res.status(403).json({ error: "Only administrators can upload pupil photos." });
    return;
  }
  const { contentType, name, size } = req.body as { contentType?: unknown; name?: unknown; size?: unknown };
  if (typeof contentType !== "string" || typeof name !== "string" || !name.trim() || typeof size !== "number" || !Number.isFinite(size) || size < 1 || size >= MAX_UPLOAD_BYTES) {
    res.status(400).json({ error: "Choose an image smaller than 1 MB." });
    return;
  }
  try {
    res.json({ ...(await requestPupilPhotoUpload(contentType)), metadata: { name, size, contentType } });
  } catch {
    res.status(400).json({ error: "Only JPEG, PNG, and WebP pupil photos are supported." });
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
  try {
    res.redirect(302, await requestObjectDownload(objectPath));
  } catch {
    res.status(404).json({ error: "Object not found" });
  }
});

export default router;