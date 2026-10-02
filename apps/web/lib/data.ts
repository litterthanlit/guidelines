import "server-only";
import { NotFoundError, readBrand } from "@guidelines/core/store";
import { notFound } from "next/navigation";

export async function loadBrand(slug: string) {
  try {
    return await readBrand(slug);
  } catch (err) {
    if (err instanceof NotFoundError || (err as Error).name === "ZodError") notFound();
    throw err;
  }
}
