/**
 * Plans store - manages implementation plans created in Plan mode
 * 
 * Usage:
 *   const { plans, fetchPlans, createPlan, updatePlan, deletePlan } = usePlansStore(projectId)
 */

type PlanStatus = "draft" | "approved" | "rejected" | "executed";

type Plan = {
  id: string;
  projectId: string;
  title: string;
  content: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
};

export function usePlansStore(projectId: Ref<string> | string) {
  const plans = ref<Plan[]>([]);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const resolvedProjectId = computed(() => 
    typeof projectId === "string" ? projectId : projectId.value
  );

  /**
   * Fetch all plans for the current project
   */
  async function fetchPlans() {
    const pid = resolvedProjectId.value;
    if (!pid) return;

    loading.value = true;
    error.value = null;

    try {
      const result = await $fetch<Plan[]>(`/api/projects/${pid}/plans`);
      plans.value = result;
    } catch (e: any) {
      error.value = e;
      console.error("[plans] Failed to fetch plans:", e.message);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Create a new plan
   */
  async function createPlan(title: string, content: string, status: PlanStatus = "draft") {
    const pid = resolvedProjectId.value;
    if (!pid) return null;

    loading.value = true;
    error.value = null;

    try {
      const newPlan = await $fetch<Plan>(`/api/projects/${pid}/plans`, {
        method: "POST",
        body: { title, content, status },
      });
      plans.value.push(newPlan);
      return newPlan;
    } catch (e: any) {
      error.value = e;
      console.error("[plans] Failed to create plan:", e.message);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get a single plan by ID
   */
  async function getPlan(planId: string) {
    const pid = resolvedProjectId.value;
    if (!pid) return null;

    try {
      const plan = await $fetch<Plan>(`/api/projects/${pid}/plans/${planId}`);
      return plan;
    } catch (e: any) {
      console.error("[plans] Failed to get plan:", e.message);
      return null;
    }
  }

  /**
   * Update an existing plan
   */
  async function updatePlan(planId: string, updates: { title?: string; content?: string; status?: PlanStatus }) {
    const pid = resolvedProjectId.value;
    if (!pid) return null;

    loading.value = true;
    error.value = null;

    try {
      const updatedPlan = await $fetch<Plan>(`/api/projects/${pid}/plans/${planId}`, {
        method: "PATCH",
        body: updates,
      });

      // Update local state
      const index = plans.value.findIndex(p => p.id === planId);
      if (index !== -1) {
        plans.value[index] = updatedPlan;
      }

      return updatedPlan;
    } catch (e: any) {
      error.value = e;
      console.error("[plans] Failed to update plan:", e.message);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Approve a plan (shorthand for status update)
   */
  async function approvePlan(planId: string) {
    return updatePlan(planId, { status: "approved" });
  }

  /**
   * Reject a plan (shorthand for status update)
   */
  async function rejectPlan(planId: string) {
    return updatePlan(planId, { status: "rejected" });
  }

  /**
   * Mark a plan as executed
   */
  async function executePlan(planId: string) {
    return updatePlan(planId, { status: "executed" });
  }

  /**
   * Delete a plan
   */
  async function deletePlan(planId: string) {
    const pid = resolvedProjectId.value;
    if (!pid) return false;

    loading.value = true;
    error.value = null;

    try {
      await $fetch(`/api/projects/${pid}/plans/${planId}`, {
        method: "DELETE",
      });

      // Update local state
      plans.value = plans.value.filter(p => p.id !== planId);
      return true;
    } catch (e: any) {
      error.value = e;
      console.error("[plans] Failed to delete plan:", e.message);
      return false;
    } finally {
      loading.value = false;
    }
  }

  // Computed getters
  const draftPlans = computed(() => plans.value.filter(p => p.status === "draft"));
  const approvedPlans = computed(() => plans.value.filter(p => p.status === "approved"));
  const rejectedPlans = computed(() => plans.value.filter(p => p.status === "rejected"));
  const executedPlans = computed(() => plans.value.filter(p => p.status === "executed"));

  return {
    // State
    plans,
    loading,
    error,

    // Computed
    draftPlans,
    approvedPlans,
    rejectedPlans,
    executedPlans,

    // Actions
    fetchPlans,
    createPlan,
    getPlan,
    updatePlan,
    approvePlan,
    rejectPlan,
    executePlan,
    deletePlan,
  };
}
