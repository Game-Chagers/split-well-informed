/*
  Warnings:

  - You are about to alter the column `amount` on the `Expense` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `ExpenseSplit` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,2)`.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ExpenseSplit" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "simplifyPayments" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(10,2);
