-- Nombre de categoría único sin distinguir mayúsculas (specs/design.md, Catálogo).
ALTER TABLE "categories" ADD COLUMN "name_key" TEXT;
UPDATE "categories" SET "name_key" = lower(btrim("name"));
ALTER TABLE "categories" ALTER COLUMN "name_key" SET NOT NULL;

-- DropIndex
DROP INDEX "categories_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key_key" ON "categories"("name_key");
