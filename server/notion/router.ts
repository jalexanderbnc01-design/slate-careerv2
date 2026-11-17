import express from "express";
import { AuthenticatedRequest } from "../firebaseStore";
import { NotionApiError, sanitizeNotionError } from "./client";
import {
  autoDetectMappingsIntoStore,
  connectNotionWorkspace,
  createNotionPageVerified,
  disconnectNotionWorkspace,
  getMappings,
  getNotionDatabaseRecords,
  getNotionStatus,
  getSyncStatusSummary,
  hydrateNotionStoreForUser,
  importFromNotion,
  listNotionDatabases,
  readNotionPage,
  resolveConflict,
  runManualSync,
  saveDomainMapping,
  searchNotionWorkspace,
  updateAccessPolicy,
  updateNotionPageVerified,
} from "./service";

function handleNotionError(res: express.Response, err: unknown) {
  if (err instanceof NotionApiError) {
    return res.status(err.status).json({
      error: err.message,
      code: err.code,
    });
  }
  return res.status(500).json({
    error: sanitizeNotionError(err),
    code: "internal_error",
  });
}

export function createNotionRouter(): express.Router {
  const router = express.Router();

  router.use(async (req: AuthenticatedRequest, _res, next) => {
    if (req.uid) {
      await hydrateNotionStoreForUser({ uid: req.uid, idToken: req.idToken });
    }
    next();
  });

  // 1. GET /api/notion/status
  router.get("/status", async (_req, res) => {
    try {
      const status = await getNotionStatus();
      res.json(status);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // Connect & Disconnect controls
  router.post("/connect", async (_req, res) => {
    try {
      const result = await connectNotionWorkspace();
      res.json(result);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  router.post("/disconnect", (_req, res) => {
    res.json(disconnectNotionWorkspace());
  });

  router.patch("/access-policy", (req, res) => {
    try {
      const { enforceAllowlist, authorizedIds } = req.body || {};
      res.json(updateAccessPolicy({ enforceAllowlist, authorizedIds }));
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 2. GET /api/notion/search
  router.get("/search", async (req, res) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q : undefined;
      const typeParam =
        req.query.type === "page" || req.query.type === "database"
          ? req.query.type
          : undefined;
      const startCursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;

      const data = await searchNotionWorkspace({
        query,
        filterObject: typeParam,
        startCursor,
        pageSize,
      });
      res.json(data);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 3. GET /api/notion/pages/:id
  router.get("/pages/:id", async (req, res) => {
    try {
      const page = await readNotionPage(req.params.id);
      res.json(page);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 4. GET /api/notion/databases
  router.get("/databases", async (_req, res) => {
    try {
      const databases = await listNotionDatabases();
      res.json({ databases });
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 5. GET /api/notion/databases/:id/records
  router.get("/databases/:id/records", async (req, res) => {
    try {
      const startCursor =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 50;
      const result = await getNotionDatabaseRecords(req.params.id, {
        startCursor,
        pageSize,
      });
      res.json(result);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // Database mapping endpoints
  router.get("/mappings", (_req, res) => {
    res.json({ mappings: getMappings() });
  });

  router.put("/mappings", (req, res) => {
    try {
      const { domain, databaseId, databaseTitle, fieldToProperty } =
        req.body || {};
      const updated = saveDomainMapping({
        domain,
        databaseId,
        databaseTitle,
        fieldToProperty,
      });
      res.json({ mappings: updated });
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  router.post("/mappings/auto-detect", async (_req, res) => {
    try {
      const dbs = await listNotionDatabases();
      const mappings = autoDetectMappingsIntoStore(dbs);
      res.json({ mappings, databasesCount: dbs.length });
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 6. POST /api/notion/import
  router.post("/import", async (req, res) => {
    try {
      const { sourceType, id, domain } = req.body || {};
      if (sourceType !== "page" && sourceType !== "database") {
        return res
          .status(400)
          .json({ error: 'sourceType must be "page" or "database".' });
      }
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "id is required." });
      }
      const imported = await importFromNotion({ sourceType, id, domain });
      res.json(imported);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 7. POST /api/notion/pages
  router.post("/pages", async (req, res) => {
    try {
      const {
        parentDatabaseId,
        parentPageId,
        title,
        contentParagraphs,
        properties,
        domain,
        domainRecord,
      } = req.body || {};
      const created = await createNotionPageVerified({
        parentDatabaseId,
        parentPageId,
        title,
        contentParagraphs,
        properties,
        domain,
        domainRecord,
      });
      res.status(201).json(created);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 8. PATCH /api/notion/pages/:id
  router.patch("/pages/:id", async (req, res) => {
    try {
      const {
        properties,
        domain,
        domainRecord,
        appendParagraphs,
        expectedLastEditedTime,
        forceOverwrite,
      } = req.body || {};
      const updated = await updateNotionPageVerified(req.params.id, {
        properties,
        domain,
        domainRecord,
        appendParagraphs,
        expectedLastEditedTime,
        forceOverwrite,
      });
      res.json(updated);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 9. POST /api/notion/sync
  router.post("/sync", async (req, res) => {
    try {
      const { direction = "bidirectional", domains = [], localData, forceConflictIds } =
        req.body || {};
      if (!["pull", "push", "bidirectional"].includes(direction)) {
        return res.status(400).json({
          error: 'direction must be "pull", "push", or "bidirectional".',
        });
      }
      const result = await runManualSync({
        direction,
        domains,
        localData,
        forceConflictIds,
      });
      res.json(result);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  // 10. GET /api/notion/sync/status
  router.get("/sync/status", (_req, res) => {
    res.json(getSyncStatusSummary());
  });

  router.post("/sync/conflicts/:id/resolve", async (req, res) => {
    try {
      const { resolution, localRecord } = req.body || {};
      if (resolution !== "keep_notion" && resolution !== "force_local") {
        return res.status(400).json({
          error: 'resolution must be "keep_notion" or "force_local".',
        });
      }
      const result = await resolveConflict(
        req.params.id,
        resolution,
        localRecord
      );
      res.json(result);
    } catch (err) {
      handleNotionError(res, err);
    }
  });

  return router;
}
