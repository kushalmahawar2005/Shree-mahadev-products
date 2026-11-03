export type Money = { amount: number; currencyCode: "INR" };

export type ProductVariant = {
  id: string;
  title: string; // "1 L"
  sizeValue: number; // 1000
  sizeUnit: "ml" | "g";
  price: Money;
  compareAtPrice?: Money;
  availableForSale: boolean;
  sku?: string;
};

export type ProductImage = { url: string; alt: string; width: number; height: number };

export type ProductCategory = "oil" | "honey" | "sweetener";

export type Product = {
  id: string;
  handle: string;
  title: string; // "Wood-Pressed Groundnut Oil"
  titleHi: string; // "मूंगफली तेल"
  category: ProductCategory;
  swatch?: string; // oil color hex
  shortDescription: string; // 1 line, for cards
  descriptionHtml: string;
  benefits: string[]; // 3–5 points
  bestFor: string[]; // ["Deep frying", "Tadka", "Pickles"]
  howToUse?: string;
  processNote?: string; // seed source + ghani detail
  labReportUrl?: string; // PDF
  shelfLife?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  priceRange: { min: Money; max: Money };
  rating?: number; // Judge.me
  reviewCount?: number;
  tags: string[];
  faqs?: { q: string; a: string }[];
  seo: { title: string; description: string };
};

export type Collection = {
  handle: string;
  title: string;
  description: string;
  image?: { url: string; alt: string };
  products: Product[];
};

export type CartLine = {
  id: string;
  quantity: number;
  variant: ProductVariant;
  product: Pick<Product, "handle" | "title" | "images">;
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  lines: CartLine[];
  subtotal: Money;
  totalQuantity: number;
};

export type ProductSort = "best" | "price-asc" | "price-desc" | "new";

export type GetProductsOptions = {
  collection?: string;
  sort?: ProductSort;
  first?: number;
};

/** Contract every commerce provider (db, mock) implements. */
export interface CommerceProvider {
  getProducts(opts?: GetProductsOptions): Promise<Product[]>;
  getProduct(handle: string): Promise<Product | undefined>;
  getCollection(handle: string): Promise<Collection | undefined>;
  getCollections(): Promise<Omit<Collection, "products">[]>;
  searchProducts(query: string): Promise<Product[]>;
  createCart(): Promise<Cart>;
  getCart(id: string): Promise<Cart | undefined>;
  addToCart(cartId: string, variantId: string, quantity: number): Promise<Cart>;
  updateCartLine(cartId: string, lineId: string, quantity: number): Promise<Cart>;
  removeCartLine(cartId: string, lineId: string): Promise<Cart>;
}
