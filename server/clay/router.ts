import { Router } from "express";
import {
  AuthenticatedRequest,
  FirestoreActor,
  extractBearerToken,
  hasAdminWebhookCredentials,
  requireFirebaseAuth,
  verifyFirebaseIdToken,
} from "../firebaseStore";
import {
  deleteIngestedCompany,
  deleteIngestedLead,
  getClayStatusSummary,
  ingestClayCompanyPayload,
  ingestClayJobPayload,
  pushJobsToClayWebhook,
  updateClayConfig,
  updateIngestedCompany,
  updateIngestedLead,
  verifyIngestAuthorization,
} from "./service";

function actorFromReq(req: AuthenticatedRequest): FirestoreActor {
  return {
    uid: req.uid!,
    idToken: req.idToken,
  };
}

async function resolveExternalIngestActor(
  req: AuthenticatedRequest
): Promise<FirestoreActor | null> {
  // 1. If a Firebase ID token was supplied (e.g. direct authenticated POST), verify and use it
  const token = extractBearerToken(
    req.headers as Record<string, string | string[] | undefined>
  );
  if (token && token.split(".").length === 3) {
    try {
      const verified = await verifyFirebaseIdToken(token);
      if (verified.emailVerified) {
        return { uid: verified.uid, idToken: token };
      }
    } catch {
      // Fall through to CLAY_INGEST_SECRET + CLAY_OWNER_UID webhook check
    }
  }

  // 2. External Clay webhook using CLAY_INGEST_SECRET + CLAY_OWNER_UID
  const ownerUid = (process.env.CLAY_OWNER_UID || "").trim();
  if (!ownerUid || !hasAdminWebhookCredentials()) {
    return null;
  }
  return { uid: ownerUid };
}

/**
 * Router mounted at /api/jobs
 * Exposes POST /api/jobs/ingest (webhook or authenticated user) and authenticated browser CRUD routes
 */
export function createJobsIngestRouter() {
  const router = Router();

  router.post("/ingest", async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await resolveExternalIngestActor(req);
      if (!actor) {
        return res.status(503).json({
          error:
            "Unattended external webhooks require CLAY_OWNER_UID and Cloud Run / service-account credentials, or a verified Firebase Auth Bearer token.",
          code: "webhook_not_configured",
        });
      }

      if (!actor.idToken) {
        const authorized = await verifyIngestAuthorization(req.headers, actor);
        if (!authorized) {
          return res.status(401).json({
            error:
              "Unauthorized Clay ingest request. Provide valid Bearer token matching CLAY_INGEST_SECRET.",
            code: "unauthorized",
          });
        }
      }

      const bypass = req.query.force === "true" || req.body?.force === true;
      const result = await ingestClayJobPayload(actor, req.body || {}, {
        bypassThreshold: bypass,
      });
      return res.status(result.ingested ? 201 : 200).json(result);
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || "Failed to ingest Clay payload.",
        code: "bad_request",
      });
    }
  });

  router.get("/ingested", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const summary = await getClayStatusSummary(actorFromReq(req));
      res.json({
        leads: summary.leads,
        companies: summary.companies,
        counts: summary.counts,
        config: summary.config,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load ingested leads." });
    }
  });

  router.patch("/ingested/:id", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await updateIngestedLead(actorFromReq(req), req.params.id, {
        status: req.body?.status,
        notes: req.body?.notes,
      });
      res.json({ lead: updated });
    } catch (err: any) {
      res.status(404).json({ error: err?.message || "Lead not found." });
    }
  });

  router.delete("/ingested/:id", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const removed = await deleteIngestedLead(actorFromReq(req), req.params.id);
      if (!removed) {
        return res.status(404).json({ error: "Lead not found." });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete lead." });
    }
  });

  return router;
}

/**
 * Router mounted at /api/clay
 * Provides status, configuration, company-row ingestion, outbound webhook push, and test helpers
 */
export function createClayRouter() {
  const router = Router();

  router.get("/status", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json(await getClayStatusSummary(actorFromReq(req)));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load Clay status." });
    }
  });

  router.patch("/config", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const config = await updateClayConfig(actorFromReq(req), {
        minMatchScore: req.body?.minMatchScore,
        requireIngestSecretWhenSet: req.body?.requireIngestSecretWhenSet,
      });
      res.json({ config });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update Clay config." });
    }
  });

  router.post("/ingest-company", async (req: AuthenticatedRequest, res) => {
    try {
      const actor = await resolveExternalIngestActor(req);
      if (!actor) {
        return res.status(503).json({
          error:
            "Unattended external webhooks require CLAY_OWNER_UID and Cloud Run / service-account credentials, or a verified Firebase Auth Bearer token.",
          code: "webhook_not_configured",
        });
      }

      if (!actor.idToken) {
        const authorized = await verifyIngestAuthorization(req.headers, actor);
        if (!authorized) {
          return res.status(401).json({
            error:
              "Unauthorized Clay ingest request. Provide valid Bearer token matching CLAY_INGEST_SECRET.",
            code: "unauthorized",
          });
        }
      }

      const bypass = req.query.force === "true" || req.body?.force === true;
      const result = await ingestClayCompanyPayload(actor, req.body || {}, {
        bypassThreshold: bypass,
      });
      return res.status(result.ingested ? 201 : 200).json(result);
    } catch (err: any) {
      return res.status(400).json({
        error: err?.message || "Failed to ingest Clay company row.",
        code: "bad_request",
      });
    }
  });

  router.patch("/companies/:id", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const updated = await updateIngestedCompany(actorFromReq(req), req.params.id, {
        status: req.body?.status,
        notes: req.body?.notes,
      });
      res.json({ company: updated });
    } catch (err: any) {
      res.status(404).json({ error: err?.message || "Company not found." });
    }
  });

  router.delete("/companies/:id", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const removed = await deleteIngestedCompany(actorFromReq(req), req.params.id);
      if (!removed) {
        return res.status(404).json({ error: "Company not found." });
      }
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete company." });
    }
  });

  router.post("/push-to-clay", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const jobs = Array.isArray(req.body?.jobs)
        ? req.body.jobs
        : req.body?.job
        ? [req.body.job]
        : [];
      const result = await pushJobsToClayWebhook(actorFromReq(req), jobs);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        error: err?.message || "Failed to push items to Clay webhook.",
      });
    }
  });

  router.post("/test-ingest", requireFirebaseAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const samplePayload =
        req.body && Object.keys(req.body).length > 0
          ? req.body
          : {
              company: "Columbus Spatial Systems",
              title: "CAD / BIM Design Specialist (Remote)",
              applyUrl: "https://example.com/careers/cad-bim-specialist",
              location: "Columbus, OH (Remote Eligible)",
              salary: "$76,000 - $88,000",
              matchScore: 9,
              matchedSkills: [
                "AutoCAD",
                "Civil 3D",
                "Construction Documentation",
                "Revit",
              ],
              missingSkills: ["Navisworks Clash Detection"],
              contact: {
                name: "Jordan Vance",
                title: "Senior Technical Recruiter",
                email: "talent@columbusspatial.example.com",
                linkedinUrl: "https://www.linkedin.com/in/jordan-vance-example",
              },
              description:
                "Seeking an AutoCAD & Civil 3D CAD/BIM Specialist to produce permit sets, utility alignments, and architectural coordination sheets. Revit and Navisworks experience preferred.",
              source: "Clay Pipeline (Test Lead)",
            };
      const result = await ingestClayJobPayload(actorFromReq(req), samplePayload, {
        bypassThreshold: false,
      });
      res.status(result.ingested ? 201 : 200).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Test ingest failed." });
    }
  });

  router.post(
    "/test-company-ingest",
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const sampleCompany =
          req.body && Object.keys(req.body).length > 0
            ? req.body
            : {
                name: "Scioto Architecture & Design Studio",
                domain: "sciotodesign.example.com",
                industry: "Architecture & Urban Design",
                size: "51-200 employees",
                location: "Columbus, OH",
                jobOpenings:
                  "Architectural CAD Technician (AutoCAD / Revit) - https://sciotodesign.example.com/careers/cad-tech",
                news: "Awarded Downtown Columbus Riverfront Civic Mixed-Use Phase II design contract.",
                competitors: ["Moody Nolan", "M+A Architects", "NBBJ Columbus"],
                funding: "Privately Held · Est. 2012",
                fitScore: 9,
                matchedSkills: ["AutoCAD", "Revit", "SketchUp", "Site Plans"],
                missingSkills: ["LEED AP BD+C"],
                contact: {
                  name: "Elena Brooks",
                  title: "Studio Operations & BIM Lead",
                  email: "elena@sciotodesign.example.com",
                },
                source: "Columbus Design Companies (Test Row)",
              };
        const result = await ingestClayCompanyPayload(actorFromReq(req), sampleCompany, {
          bypassThreshold: false,
        });
        res.status(result.ingested ? 201 : 200).json(result);
      } catch (err: any) {
        res
          .status(400)
          .json({ error: err?.message || "Test company ingest failed." });
      }
    }
  );

  return router;
}
