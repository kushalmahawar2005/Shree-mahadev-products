// Restore missing starter variants in the explicitly isolated QA schema only.
import { products } from "../src/data/products.ts";
import { connectQaDatabase } from "./test-db.mjs";

process.loadEnvFile(".env.local");
const db = await connectQaDatabase();
let restored = 0;

try {
  for (const product of products) {
    const [[owner]] = await db.query("SELECT id FROM products WHERE handle=?", [product.handle]);
    if (!owner) continue;
    for (const [index, variant] of product.variants.entries()) {
      const [[existing]] = await db.query("SELECT id FROM product_variants WHERE variant_key=?", [variant.id]);
      if (existing) continue;
      const [[skuOwner]] = variant.sku
        ? await db.query("SELECT variant_key FROM product_variants WHERE sku=?", [variant.sku])
        : [[]];
      if (skuOwner) throw new Error(`Cannot restore ${variant.id}: its SKU is already assigned to another QA variant`);
      await db.execute(
        `INSERT INTO product_variants (product_id,variant_key,title,size_value,size_unit,sku,price,compare_at_price,stock_qty,available,weight_grams,sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [owner.id, variant.id, variant.title, variant.sizeValue, variant.sizeUnit, variant.sku ?? null, variant.price.amount,
          variant.compareAtPrice?.amount ?? null, null, variant.availableForSale ? 1 : 0, null, index],
      );
      restored++;
    }
  }
} finally {
  await db.end();
}

console.log(`Restored ${restored} missing starter variant(s) in ${process.env.DATABASE_NAME}.`);
