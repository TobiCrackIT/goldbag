/**
 * Must be imported before anything touching @solana/web3.js: React
 * Native has no crypto.getRandomValues and no global Buffer, both of
 * which web3.js assumes. Imported first in app/_layout.tsx.
 */
import "react-native-get-random-values";
import { Buffer } from "buffer";

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
