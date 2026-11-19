import { categories } from "@/data/categories";
import { collections } from "@/data/collections";
import { products as demoProducts } from "@/data/products";
import { realProducts } from "@/data/real-products";

/** Catalogue written in the code (src/data): the base everywhere, the only one on dourya.fr. */
export const fixtures = { categories, collections, products: [...demoProducts, ...realProducts] };
