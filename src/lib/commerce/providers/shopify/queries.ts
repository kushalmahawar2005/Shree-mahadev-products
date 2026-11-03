const METAFIELDS = `
  metafields(identifiers: [
    { namespace: "custom", key: "title_hi" }
    { namespace: "custom", key: "swatch" }
    { namespace: "custom", key: "benefits" }
    { namespace: "custom", key: "best_for" }
    { namespace: "custom", key: "how_to_use" }
    { namespace: "custom", key: "process_note" }
    { namespace: "custom", key: "lab_report" }
    { namespace: "custom", key: "shelf_life" }
    { namespace: "custom", key: "faqs" }
  ]) {
    key
    value
    reference { ... on GenericFile { url } }
  }
`;

export const PRODUCT_FRAGMENT = `
  fragment ProductFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    productType
    tags
    seo { title description }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 10) { nodes { url altText width height } }
    variants(first: 30) {
      nodes {
        id
        title
        sku
        availableForSale
        price { amount currencyCode }
        compareAtPrice { amount currencyCode }
        selectedOptions { name value }
      }
    }
    ${METAFIELDS}
  }
`;

export const PRODUCTS_QUERY = `
  ${PRODUCT_FRAGMENT}
  query Products($first: Int!, $sortKey: ProductSortKeys, $reverse: Boolean, $query: String) {
    products(first: $first, sortKey: $sortKey, reverse: $reverse, query: $query) {
      nodes { ...ProductFields }
    }
  }
`;

export const PRODUCT_QUERY = `
  ${PRODUCT_FRAGMENT}
  query Product($handle: String!) {
    product(handle: $handle) { ...ProductFields }
  }
`;

export const COLLECTION_QUERY = `
  ${PRODUCT_FRAGMENT}
  query Collection($handle: String!, $first: Int!, $sortKey: ProductCollectionSortKeys, $reverse: Boolean) {
    collection(handle: $handle) {
      handle
      title
      description
      image { url altText }
      products(first: $first, sortKey: $sortKey, reverse: $reverse) {
        nodes { ...ProductFields }
      }
    }
  }
`;

export const COLLECTIONS_QUERY = `
  query Collections {
    collections(first: 50) {
      nodes { handle title description image { url altText } }
    }
  }
`;

export const CART_FRAGMENT = `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost { subtotalAmount { amount currencyCode } }
    lines(first: 100) {
      nodes {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            sku
            availableForSale
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
            product {
              handle
              title
              images(first: 1) { nodes { url altText width height } }
            }
          }
        }
      }
    }
  }
`;

export const CART_QUERY = `
  ${CART_FRAGMENT}
  query Cart($id: ID!) { cart(id: $id) { ...CartFields } }
`;
