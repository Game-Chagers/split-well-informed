/*
  Warnings:

  - You are about to alter the column `amount` on the `Expense` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,4)`.
  - You are about to alter the column `amount` on the `ExpenseSplit` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,4)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,4)`.
  - A unique constraint covering the columns `[userId,expenseId]` on the table `ExpenseSplit` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "ExpenseSplit" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,4);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,4);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseSplit_userId_expenseId_key" ON "ExpenseSplit"("userId", "expenseId");
