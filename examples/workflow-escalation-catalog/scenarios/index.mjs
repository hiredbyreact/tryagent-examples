import { scenario as accountRiskReview } from "./account-risk-review.mjs";
import { scenario as appointmentScheduling } from "./appointment-scheduling.mjs";
import { scenario as contentModeration } from "./content-moderation.mjs";
import { scenario as contractClauseReview } from "./contract-clause-review.mjs";
import { scenario as customerSupportPolicyException } from "./customer-support-policy-exception.mjs";
import { scenario as invoiceApproval } from "./invoice-approval.mjs";
import { scenario as jobApplicationScreening } from "./job-application-screening.mjs";
import { scenario as leadQualification } from "./lead-qualification.mjs";
import { scenario as shippingException } from "./shipping-exception.mjs";

export const scenarios = [
  accountRiskReview,
  appointmentScheduling,
  contentModeration,
  contractClauseReview,
  customerSupportPolicyException,
  invoiceApproval,
  jobApplicationScreening,
  leadQualification,
  shippingException,
].sort((left, right) => left.slug.localeCompare(right.slug));
