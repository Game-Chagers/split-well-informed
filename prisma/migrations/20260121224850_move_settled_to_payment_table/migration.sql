/*
  Warnings:

  - You are about to drop the column `settled` on the `ExpenseSplit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ExpenseSplit" DROP COLUMN "settled";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "settled" BOOLEAN NOT NULL DEFAULT false;
