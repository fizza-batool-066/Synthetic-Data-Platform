// Locale-specific data for countries that Faker covers poorly or not at all.
// Pakistan is in pakistan.ts; this file adds India, UAE, and helpers for the
// phone styles referenced in countries.ts (in/ae/gb/us).
import type { CountryInfo } from "./countries";

// --- India ---
export const IN_MALE_FIRST = [
  "Rahul", "Amit", "Raj", "Vikram", "Sanjay", "Arjun", "Karan", "Rohan",
  "Suresh", "Anil", "Deepak", "Manish", "Rakesh", "Vijay", "Pradeep", "Naveen",
  "Krishna", "Gaurav", "Sachin", "Vivek", "Ajay", "Akash", "Nikhil", "Varun",
];
export const IN_FEMALE_FIRST = [
  "Priya", "Anjali", "Pooja", "Neha", "Kavya", "Sneha", "Divya", "Anita",
  "Sunita", "Meena", "Ritu", "Shreya", "Aarti", "Bhavna", "Deepika", "Karishma",
  "Lakshmi", "Manisha", "Nisha", "Pallavi", "Rashi", "Sara", "Tanvi", "Urvi",
];
export const IN_LAST = [
  "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Reddy", "Nair",
  "Iyer", "Menon", "Joshi", "Mehta", "Agarwal", "Bhatt", "Chopra", "Kapoor",
  "Malhotra", "Mishra", "Rao", "Das", "Banerjee", "Mukherjee", "Chatterjee",
];
export const IN_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Pune",
  "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore",
  "Bhopal", "Patna", "Vadodara", "Visakhapatnam", "Coimbatore", "Kochi",
];

// --- UAE ---
export const AE_MALE_FIRST = [
  "Mohammed", "Ahmed", "Ali", "Hassan", "Hussain", "Khalid", "Saeed", "Abdulla",
  "Rashid", "Omar", "Yousuf", "Ibrahim", "Salim", "Nasser", "Faisal", "Majed",
];
export const AE_FEMALE_FIRST = [
  "Fatima", "Aisha", "Maryam", "Noor", "Latifa", "Shamsa", "Mona", "Hessa",
  "Moza", "Alya", "Reem", "Layla", "Amna", "Sara", "Mahra", "Shaikha",
];
export const AE_LAST = [
  "Al Maktoum", "Al Nahyan", "Al Rashid", "Al Mansouri", "Al Marri", "Al Bloshi",
  "Al Falasi", "Al Zaabi", "Al Ketbi", "Al Suwaidi", "Al Hammadi", "Al Shamsi",
  "Al Dhaheri", "Al Shehhi", "Al Rashedi",
];
export const AE_CITIES = [
  "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah",
  "Fujairah", "Umm Al Quwain", "Jebel Ali", "Khor Fakkan",
];

// Pick a random element.
function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Generate a phone number matching the country's phone style.
export function localePhone(rng: () => number, country: CountryInfo): string {
  const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");
  switch (country.phoneStyle) {
    case "pk": {
      // Pakistani: +92 3XX XXXXXXX (mobile) or +92 2X XXXXXXX (landline)
      const prefixes = ["300", "301", "302", "310", "311", "320", "321", "330", "331"];
      return `${country.dial} ${pick(rng, prefixes)} ${digits(7)}`;
    }
    case "in": {
      // Indian: +91 6XXXXXXXXX or 7XXXXXXXXX or 8XXXXXXXXX or 9XXXXXXXXX (10 digits)
      const first = pick(rng, ["6", "7", "8", "9"]);
      return `${country.dial} ${first}${digits(9)}`;
    }
    case "ae": {
      // UAE: +971 5X XXXXXXX (mobile)
      const prefixes = ["50", "52", "54", "55", "56", "58"];
      return `${country.dial} ${pick(rng, prefixes)} ${digits(7)}`;
    }
    case "gb": {
      // UK: +44 7XXX XXXXXX (mobile)
      return `${country.dial} 7${digits(3)} ${digits(6)}`;
    }
    case "us":
    case "generic":
    default: {
      // US/generic: +1 XXX XXXXXXX
      return `${country.dial} ${digits(3)} ${digits(7)}`;
    }
  }
}

// Get locale-specific first/last name pools for a country. Falls back to empty
// arrays when Faker handles it natively (the generators use Faker in that case).
export function localeNamePools(country: CountryInfo): {
  male: string[] | null;
  female: string[] | null;
  last: string[] | null;
  cities: string[] | null;
} {
  switch (country.code) {
    case "IN":
      return { male: IN_MALE_FIRST, female: IN_FEMALE_FIRST, last: IN_LAST, cities: IN_CITIES };
    case "AE":
      return { male: AE_MALE_FIRST, female: AE_FEMALE_FIRST, last: AE_LAST, cities: AE_CITIES };
    default:
      return { male: null, female: null, last: null, cities: null };
  }
}

export { pick };
