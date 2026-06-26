const slug = "appointment-scheduling";
const trigger =
  "New requested time conflicts with VIP/customer priority rules.";

export const scenario = {
  slug,
  name: "Appointment scheduling",
  activity: "AI scheduling agent manages appointments",
  trigger,
  policy: "appointment.scheduling.priority.v1",
  escalation: {
    agentId: "appointment-scheduling-agent",
    runId: "appointment-run-2026-06-25-vip-0731",
    subject: "VIP appointment request conflicts with priority rules",
    question:
      "Should TryAgent move an existing customer appointment to accept the VIP customer's requested time?",
    evidence: [
      "Requested time 2026-07-02T15:00:00-05:00 overlaps with appointment APT-731 for an existing customer.",
      "Customer Magnolia Capital is marked VIP with priority scheduling enabled for urgent onboarding appointments.",
      "Priority policy requires human approval before displacing a confirmed appointment within 48 hours.",
      "The existing customer has no prior reschedules and can be offered 2026-07-02T16:30:00-05:00.",
    ],
    choices: [
      {
        id: "move-existing-appointment",
        label: "Move existing appointment",
        consequence:
          "The VIP customer receives the requested time and the existing customer is offered the next available slot.",
        reversible: true,
      },
      {
        id: "decline-vip-request",
        label: "Decline VIP request",
        consequence:
          "The confirmed appointment remains unchanged and the VIP customer is offered alternate times.",
        reversible: true,
      },
      {
        id: "request-coordinator-review",
        label: "Request coordinator review",
        consequence:
          "Both appointments remain on hold while a scheduling coordinator validates customer priority and outreach timing.",
        reversible: true,
      },
    ],
    severity: "high",
    metadata: {
      workflowSlug: slug,
      trigger,
      appointmentId: "APT-731",
      requestedCustomer: "Magnolia Capital",
      requestedTime: "2026-07-02T15:00:00-05:00",
    },
  },
  decision: {
    choice: "request-coordinator-review",
    reason:
      "A confirmed appointment would be displaced within 48 hours, so a coordinator should approve the customer outreach before changing the schedule.",
  },
  expectedEvidence: /priority scheduling enabled for urgent onboarding appointments/i,
};
