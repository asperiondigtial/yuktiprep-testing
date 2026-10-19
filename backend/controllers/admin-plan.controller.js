import * as planService from "../services/plan.service.js";
import { successResponse, errorResponse } from "../utils/response.js";
import { getPagination, buildPaginationMeta } from "../utils/pagination.js";
import { planSchema, planQuerySchema, reorderPlansSchema } from "../validators/plan.validator.js";

export const adminGetPlans = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = getPagination({
      sort: req.query.sort || "sortOrder",
      order: req.query.order || "asc",
      ...req.query,
    });

    const [plansResult, total] = await Promise.all([
      planService.getPlans({ page, limit, skip, sort, order }),
      planService.countPlans(),
    ]);

    const [plans] = plansResult;

    successResponse(res, "Plans fetched successfully", plans, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
};

export const adminGetPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const plan = await planService.getPlanById(id);

    if (!plan) {
      return errorResponse(res, "Plan not found", [], 404);
    }

    successResponse(res, "Plan fetched successfully", plan);
  } catch (error) {
    next(error);
  }
};

export const adminCreatePlan = async (req, res, next) => {
  try {
    const validated = planSchema.parse(req.body);

    const existing = await planService.getPlanByKey(validated.key);
    if (existing) {
      return errorResponse(res, "A plan with this key already exists", [], 400);
    }

    const { features, ...planData } = validated;
    const plan = await planService.createPlan(planData);

    if (features && features.length > 0) {
      await planService.createFeatures(plan.id, features);
    }

    const createdPlan = await planService.getPlanById(plan.id);
    successResponse(res, "Plan created successfully", createdPlan, {}, 201);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    next(error);
  }
};

export const adminUpdatePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = planSchema.partial().parse(req.body);

    const existing = await planService.getPlanById(id);
    if (!existing) {
      return errorResponse(res, "Plan not found", [], 404);
    }

    if (validated.key && validated.key !== existing.key) {
      const keyExists = await planService.getPlanByKey(validated.key);
      if (keyExists) {
        return errorResponse(res, "A plan with this key already exists", [], 400);
      }
    }

    const { features, ...planData } = validated;
    const updatedPlan = await planService.updatePlan(id, planData);

    if (features !== undefined) {
      await planService.replaceFeatures(id, features);
    }

    const plan = await planService.getPlanById(id);
    successResponse(res, "Plan updated successfully", plan);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    next(error);
  }
};

export const adminPatchPlanStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return errorResponse(res, "isActive must be a boolean", [], 400);
    }

    const existing = await planService.getPlanById(id);
    if (!existing) {
      return errorResponse(res, "Plan not found", [], 404);
    }

    const plan = await planService.updatePlan(id, { isActive });
    successResponse(res, `Plan ${isActive ? "activated" : "deactivated"} successfully`, plan);
  } catch (error) {
    next(error);
  }
};

export const adminReorderPlans = async (req, res, next) => {
  try {
    const validated = reorderPlansSchema.parse(req.body);

    await planService.reorderPlans(validated.plans);
    const updatedPlans = await planService.getAllPlans();

    successResponse(res, "Plans reordered successfully", updatedPlans);
  } catch (error) {
    if (error.name === "ZodError") {
      return errorResponse(res, "Validation failed", error.errors, 400);
    }
    next(error);
  }
};

export const adminDeletePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await planService.getPlanById(id);
    if (!existing) {
      return errorResponse(res, "Plan not found", [], 404);
    }

    await planService.deletePlan(id);
    successResponse(res, "Plan deleted successfully", { id });
  } catch (error) {
    if (error.message && error.message.includes("Cannot delete plan")) {
      return errorResponse(res, error.message, [], 400);
    }
    next(error);
  }
};

