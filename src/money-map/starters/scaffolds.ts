import type { MoneyMapDocument, StarterId } from "../model/types";
import { createStarterDocument } from "./registry";

/** @deprecated Use createStarterDocument. Kept only while shared callers migrate. */
export function getScaffoldDocument(id: StarterId): MoneyMapDocument {
  return createStarterDocument(id);
}
