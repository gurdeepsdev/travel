import {
  Router,
} from "express";

import AuthMiddleware
  from "../../middleware/auth.middleware.js";
import validate
  from "../../middleware/validate.middleware.js";

import ItineraryController
  from "./itinerary.controller.js";
import ItineraryVaultController
  from "./itinerary-vault.controller.js";
import ItineraryEssentialsController
  from "./itinerary-essentials.controller.js";
import ItineraryExpenseParticipantsController
  from "./itinerary-expense-participants.controller.js";
import ItineraryExpensesController
  from "./itinerary-expenses.controller.js";
import ItineraryExpenseSettlementsController
  from "./itinerary-expense-settlements.controller.js";
import ItineraryExpenseRemindersController
  from "./itinerary-expense-reminders.controller.js";
import itineraryVaultUploadMiddleware
  from "./itinerary-vault-upload.middleware.js";
import {
  getItinerarySchema,
  listItinerariesSchema,
  saveItinerarySchema,
  updateItineraryStatusSchema,
  uploadVaultDocumentSchema,
  listVaultDocumentsSchema,
  deleteVaultDocumentSchema,
  updateVaultDocumentVisibilitySchema,
  updateItinerarySchema,
  updateItineraryNameSchema,
  createEssentialSchema,
  listEssentialsSchema,
  updateEssentialSchema,
  setEssentialSelectionSchema,
  deleteEssentialSchema,
  addExpenseParticipantSchema,
  listExpenseParticipantsSchema,
  removeExpenseParticipantSchema,
  createExpenseSchema,
  listExpensesSchema,
  getExpenseSchema,
  updateExpenseSchema,
  replaceExpenseSplitsSchema,
  deleteExpenseSchema,
  getExpenseDashboardSchema,
  createExpenseSettlementSchema,
  listExpenseSettlementsSchema,
  updateExpenseSettlementSchema,
  createExpenseReminderSchema,
} from "./itinerary.validation.js";

const router = Router();

router.get(
  "/completed",
  AuthMiddleware.authenticate,
  validate(
    listItinerariesSchema,
  ),
  ItineraryController
    .listCompletedItineraries,
);

router.delete(
  "/:itineraryId/expense-participants/:userId",
  AuthMiddleware.authenticate,
  validate(removeExpenseParticipantSchema),
  ItineraryExpenseParticipantsController
    .removeParticipant,
);

router.post(
  "/:itineraryId/expenses",
  AuthMiddleware.authenticate,
  validate(createExpenseSchema),
  ItineraryExpensesController.createExpense,
);

router.get(
  "/:itineraryId/expenses",
  AuthMiddleware.authenticate,
  validate(listExpensesSchema),
  ItineraryExpensesController.listExpenses,
);

router.get(
  "/:itineraryId/expenses/dashboard",
  AuthMiddleware.authenticate,
  validate(getExpenseDashboardSchema),
  ItineraryExpensesController.getDashboard,
);

router.get(
  "/:itineraryId/expense-balances",
  AuthMiddleware.authenticate,
  validate(getExpenseDashboardSchema),
  ItineraryExpensesController.getBalances,
);

router.get(
  "/:itineraryId/expenses/:expenseId",
  AuthMiddleware.authenticate,
  validate(getExpenseSchema),
  ItineraryExpensesController.getExpense,
);

router.patch(
  "/:itineraryId/expenses/:expenseId",
  AuthMiddleware.authenticate,
  validate(updateExpenseSchema),
  ItineraryExpensesController.updateExpense,
);

router.put(
  "/:itineraryId/expenses/:expenseId/splits",
  AuthMiddleware.authenticate,
  validate(replaceExpenseSplitsSchema),
  ItineraryExpensesController.replaceExpenseSplits,
);

router.delete(
  "/:itineraryId/expenses/:expenseId",
  AuthMiddleware.authenticate,
  validate(deleteExpenseSchema),
  ItineraryExpensesController.deleteExpense,
);

router.post(
  "/:itineraryId/expense-settlements",
  AuthMiddleware.authenticate,
  validate(createExpenseSettlementSchema),
  ItineraryExpenseSettlementsController.create,
);

router.get(
  "/:itineraryId/expense-settlements",
  AuthMiddleware.authenticate,
  validate(listExpenseSettlementsSchema),
  ItineraryExpenseSettlementsController.list,
);

router.patch(
  "/:itineraryId/expense-settlements/:settlementId",
  AuthMiddleware.authenticate,
  validate(updateExpenseSettlementSchema),
  ItineraryExpenseSettlementsController.update,
);

router.post(
  "/:itineraryId/expense-reminders",
  AuthMiddleware.authenticate,
  validate(createExpenseReminderSchema),
  ItineraryExpenseRemindersController.create,
);

router.get(
  "/",
  AuthMiddleware.authenticate,
  validate(
    listItinerariesSchema,
  ),
  ItineraryController.listItineraries,
);

router.get(
  "/:itineraryId",
  AuthMiddleware.authenticate,
  validate(
    getItinerarySchema,
  ),
  ItineraryController.getItinerary,
);

router.get(
  "/:itineraryId/dashboard",
  AuthMiddleware.authenticate,
  validate(
    getItinerarySchema,
  ),
  ItineraryController
    .getItineraryDashboard,
);

router.put(
  "/:itineraryId",
  AuthMiddleware.authenticate,
  validate(updateItinerarySchema),
  ItineraryController.updateItinerary,
);

router.delete(
  "/:itineraryId",
  AuthMiddleware.authenticate,
  validate(getItinerarySchema),
  ItineraryController.deleteItinerary,
);

router.patch(
  "/:itineraryId/status",
  AuthMiddleware.authenticate,
  validate(
    updateItineraryStatusSchema,
  ),
  ItineraryController
    .updateItineraryStatus,
);

router.patch(
  "/:itineraryId/name",
  AuthMiddleware.authenticate,
  validate(updateItineraryNameSchema),
  ItineraryController
    .updateItineraryName,
);

router.post(
  "/:itineraryId/expense-participants",
  AuthMiddleware.authenticate,
  validate(addExpenseParticipantSchema),
  ItineraryExpenseParticipantsController
    .addParticipant,
);

router.get(
  "/:itineraryId/expense-participants",
  AuthMiddleware.authenticate,
  validate(listExpenseParticipantsSchema),
  ItineraryExpenseParticipantsController
    .listParticipants,
);

router.post(
  "/:itineraryId/share",
  AuthMiddleware.authenticate,
  validate(getItinerarySchema),
  ItineraryController.createShareLink,
);

router.post(
  "/:itineraryId/vault/documents",
  AuthMiddleware.authenticate,
  itineraryVaultUploadMiddleware,
  validate(uploadVaultDocumentSchema),
  ItineraryVaultController
    .uploadDocument,
);

router.get(
  "/:itineraryId/vault/documents",
  AuthMiddleware.authenticate,
  validate(listVaultDocumentsSchema),
  ItineraryVaultController
    .listDocuments,
);

router.delete(
  "/:itineraryId/vault/documents/:documentId",
  AuthMiddleware.authenticate,
  validate(deleteVaultDocumentSchema),
  ItineraryVaultController
    .deleteDocument,
);

router.get(
  "/:itineraryId/vault/documents/:documentId/download",
  AuthMiddleware.authenticate,
  validate(deleteVaultDocumentSchema),
  ItineraryVaultController.downloadDocument,
);

router.patch(
  "/:itineraryId/vault/documents/:documentId/visibility",
  AuthMiddleware.authenticate,
  validate(updateVaultDocumentVisibilitySchema),
  ItineraryVaultController.updateDocumentVisibility,
);

router.post(
  "/:itineraryId/essentials",
  AuthMiddleware.authenticate,
  validate(createEssentialSchema),
  ItineraryEssentialsController
    .createEssential,
);

router.get(
  "/:itineraryId/essentials",
  AuthMiddleware.authenticate,
  validate(listEssentialsSchema),
  ItineraryEssentialsController
    .listEssentials,
);

router.patch(
  "/:itineraryId/essentials/:essentialId",
  AuthMiddleware.authenticate,
  validate(updateEssentialSchema),
  ItineraryEssentialsController
    .updateEssential,
);

router.patch(
  "/:itineraryId/essentials/:essentialId/selection",
  AuthMiddleware.authenticate,
  validate(
    setEssentialSelectionSchema,
  ),
  ItineraryEssentialsController
    .setEssentialSelection,
);

router.delete(
  "/:itineraryId/essentials/:essentialId",
  AuthMiddleware.authenticate,
  validate(deleteEssentialSchema),
  ItineraryEssentialsController
    .deleteEssential,
);

router.post(
  "/",
  AuthMiddleware.authenticate,
  validate(
    saveItinerarySchema,
  ),
  ItineraryController.saveItinerary,
);

export default router;
