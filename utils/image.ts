/**
 * Constructs a URL for a high-resolution item image from the OSRS Wiki.
 * The wiki formats image filenames by capitalizing the first letter and
 * replacing spaces with underscores. It also requires URL encoding for
 * certain special characters like `+` and `'`.
 * @param itemName The name of the item from the OSRS Wiki API.
 * @returns The full URL to the item's image.
 */
export const getHighResImageUrl = (itemName: string): string => {
  if (!itemName) return '';

  // Step 0: Trim whitespace and standardize names to ensure a space before parentheses.
  const standardizedName = itemName.trim().replace(/(?<! )\(/g, ' (');

  // Step 1: Create the base filename, replacing spaces and encoding special characters for the URL.
  let baseFileName = standardizedName.replace(/ /g, '_');
  baseFileName = baseFileName.charAt(0).toUpperCase() + baseFileName.slice(1);
  baseFileName = baseFileName
    .replace(/\+/g, '%2B')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

  const lowerCaseName = standardizedName.toLowerCase();
  
  // A list of item types that typically use stack images (_5.png) on the wiki.
  const stackableSuffixes = [
    ' bolt tips', ' bolts', ' bolt rack', ' dart', ' darts', ' arrow', ' arrows', 
    ' shaft', ' shafts', ' seed', ' seeds'
  ];
  
  // Extract the base name before any parenthesis for checking.
  // This correctly identifies "Rune arrow" from "Rune arrow (p++)".
  const baseNameForCheck = lowerCaseName.split('(')[0].trim();

  // If the base item name ends with a stackable suffix, we request the stack image (_5.png).
  // The OSRS Wiki is generally good at redirecting to the singular image if a stack image doesn't exist,
  // making this a safe and consistent approach.
  if (stackableSuffixes.some(suffix => baseNameForCheck.endsWith(suffix))) {
      return `https://oldschool.runescape.wiki/images/${baseFileName}_5.png`;
  }
  
  // Return the default formatted URL for all other items.
  return `https://oldschool.runescape.wiki/images/${baseFileName}.png`;
};

/**
 * Creates a data URL for a base64-encoded image or returns an existing data URL.
 * @param iconData The base64 string or full data URL of the icon.
 * @returns The full data URL for the image.
 */
export const createIconDataUrl = (iconData: string): string => {
    if (!iconData) return ''; // Handle cases where an icon might be missing
    // If the icon data is already a valid data URL, return it as is.
    if (iconData.startsWith('data:image/')) {
        return iconData;
    }
    // Otherwise, assume it's a raw base64 string and construct the data URL.
    return `data:image/png;base64,${iconData}`;
};

/**
 * Parses a string that may contain 'k' (thousands) or 'm' (millions)
 * shorthands into a number.
 * e.g., "100k" -> 100000, "2.5m" -> 2500000
 * @param value The string value to parse.
 * @returns The parsed number, or NaN if invalid.
 */
export const parseShorthandPrice = (value: string): number => {
  if (typeof value !== 'string' || !value) return NaN;

  const sanitizedValue = value.toLowerCase().trim();
  const multiplier = sanitizedValue.endsWith('m') ? 1000000 : sanitizedValue.endsWith('k') ? 1000 : 1;
  
  // Remove commas and the k/m suffix for parsing
  const numPart = sanitizedValue.replace(/,/g, '').replace(/[km]$/, '');

  // An empty string is not a valid number
  if (numPart.trim() === '') return NaN;

  const number = parseFloat(numPart);
  if (isNaN(number)) return NaN;

  return Math.floor(number * multiplier);
};

const TAX_EXEMPT_ITEMS = new Set([
  'Old school bonds',
  'Energy potion',
  'Bronze arrow',
  'Bronze dart',
  'Iron arrow',
  'Iron dart',
  'Mind rune',
  'Steel arrow',
  'Steel dart',
  'Bass',
  'Bread',
  'Cake',
  'Cooked chicken',
  'Cooked meat',
  'Herring',
  'Lobster',
  'Mackerel',
  'Meat pie',
  'Pike',
  'Salmon',
  'Shrimps',
  'Tuna',
  'Ardougne teleport',
  'Camelot teleport',
  'Civitas illa fortis teleport',
  'Falador teleport',
  'Games necklace (8)',
  'Kourend castle teleport',
  'Lumbridge teleport',
  'Ring of dueling (8)',
  'Teleport to house',
  'Varrock teleport',
  'Chisel',
  'Gardening trowel',
  'Glassblowing pipe',
  'Hammer',
  'Needle',
  'Pestle and mortar',
  'Rake',
  'Saw',
  'Secateurs',
  'Seed dibber',
  'Shears',
  'Spade',
  'Watering can (0)',
]);

export const TAX_RATE = 0.02; // Updated to 2% as requested
const MIN_PRICE_FOR_TAX_THRESHOLD = 100;
export const MAX_TAX_AMOUNT = 5_000_000;

/**
 * Calculates the Grand Exchange tax for a transaction based on OSRS mechanics.
 * @param itemName The name of the item being sold.
 * @param sellPrice The price per item.
 * @param quantity The number of items sold.
 * @returns The total tax amount, rounded down.
 */
export const calculateGeTax = (itemName: string, sellPrice: number, quantity: number): number => {
  if (TAX_EXEMPT_ITEMS.has(itemName)) {
    return 0;
  }

  // Tax is not applied on items sold for under 100 coins.
  if (sellPrice < MIN_PRICE_FOR_TAX_THRESHOLD) {
    return 0;
  }

  const totalSaleValue = sellPrice * quantity;
  // The tax is applied to the total value, rounded down.
  const rawTax = Math.floor(totalSaleValue * TAX_RATE);
  
  // The tax is capped at 5 million gp per transaction.
  return Math.min(rawTax, MAX_TAX_AMOUNT);
};

/**
 * Formats a large number into a human-readable string with abbreviations (k, m, b).
 * e.g., 1234 -> "1.2k", 1234567 -> "1.2m", -2500000 -> "-2.5m"
 * @param num The number to format.
 * @returns The formatted string.
 */
export const formatLargeNumber = (num: number): string => {
    if (Math.abs(num) < 1000) {
        return num.toLocaleString();
    }
    const sign = Math.sign(num);
    const absNum = Math.abs(num);
    const SI_UNITS = [
        { value: 1e12, symbol: "t" },
        { value: 1e9, symbol: "b" },
        { value: 1e6, symbol: "m" },
        { value: 1e3, symbol: "k" }
    ];
    const unit = SI_UNITS.find(u => absNum >= u.value);
    if (unit) {
        const value = (absNum / unit.value).toFixed(1);
        return (sign < 0 ? "-" : "") + value + unit.symbol;
    }
    return (sign < 0 ? "-" : "") + absNum.toLocaleString();
};
