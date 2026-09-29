// Pakistani locale data for the synthetic data engine.
// @faker-js/faker has no built-in Pakistani locale, so we provide real Pakistani
// first names, last names, cities, and phone formats here. When the chosen
// locale is "en_PK" (or "ur_PK"), the generator uses this data instead of the
// generic English fallback so names, cities and phones look authentically Pakistani.

// Real Pakistani/Muslim male first names (common across Pakistan).
export const PK_MALE_FIRST_NAMES = [
  "Muhammad", "Ahmed", "Ali", "Hassan", "Hussain", "Bilal", "Usman", "Umar",
  "Abdullah", "Abdul Rahman", "Imran", "Kamran", "Nadeem", "Naveed", "Sajid",
  "Tariq", "Waseem", "Yasir", "Zeeshan", "Asad", "Faisal", "Hamza", "Junaid",
  "Kashif", "Mohsin", "Noman", "Rizwan", "Saad", "Shahid", "Sohail", "Aamir",
  "Adnan", "Arslan", "Awais", "Danish", "Farhan", "Haris", "Irfan", "Khalid",
  "Mansoor", "Nasir", "Owais", "Qasim", "Raheel", "Shahzad", "Tahir", "Umair",
  "Waqar", "Yousuf", "Zain", "Asif", "Babar", "Ghufran", "Hanan", "Inam",
];

// Real Pakistani/Muslim female first names.
export const PK_FEMALE_FIRST_NAMES = [
  "Ayesha", "Fatima", "Maryam", "Khadija", "Zainab", "Hira", "Sana", "Aisha",
  "Hina", "Sadia", "Nida", "Rabia", "Sumaira", "Ambreen", "Naila", "Sehrish",
  "Anum", "Iqra", "Mahnoor", "Rimsha", "Sidra", "Tooba", "Uzma", "Wajeeha",
  "Yumna", "Zoya", "Amna", "Bushra", "Farah", "Gulnaz", "Hajra", "Iram",
  "Kiran", "Laiba", "Mehwish", "Nabila", "Pareesa", "Qurat", "Rida", "Saba",
  "Tania", "Umaima", "Warda", "Yusra", "Zara", "Amber", "Faria", "Hooria",
];

// Real Pakistani last names / family names (includes common tribal/surname forms).
export const PK_LAST_NAMES = [
  "Khan", "Ahmed", "Malik", "Sheikh", "Qureshi", "Siddiqui", "Butt", "Chaudhry",
  "Rana", "Hashmi", "Raza", "Ali", "Hussain", "Iqbal", "Awan", "Cheema",
  "Bhatti", "Mughal", "Shah", "Baig", "Mirza", "Farooqi", "Ansari", "Usmani",
  "Soomro", "Talpur", "Jatoi", "Memon", "Kazi", "Pathan", "Afridi", "Yousafzai",
  "Baloch", "Jamali", "Leghari", "Gillani", "Abbasi", "Qadri", "Naqvi", "Zaidi",
  "Bukhari", "Jafri", "Rizvi", "Abidi", "Gardezi", "Mashhadi", "Lodhi", "Khokhar",
];

// Real Pakistani cities (major + mid-size), with a few districts for variety.
export const PK_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Peshawar", "Quetta", "Hyderabad", "Sialkot", "Gujranwala", "Bahawalpur",
  "Sargodha", "Sukkur", "Mardan", "Mingora", "Sheikhupura", "Mandi Bahauddin",
  "Rahim Yar Khan", "Jhang", "Dera Ghazi Khan", "Gujrat", "Sahiwal",
  "Wah Cantonment", "Muzaffarabad", "Bahawalnagar", "Okara", "Kasur",
  "Abbottabad", "Nawabshah", "Bannu", "Khuzdar", "Dera Ismail Khan",
  "Mirpur", "Muzaffargarh", "Kohat", "Chiniot", "Jhelum", "Hafizabad",
];

// Real Pakistani currency and dialing code.
export const PK_INFO = {
  code: "PK",
  country: "Pakistan",
  currency: "PKR",
  dial: "+92",
};

// Generate a realistic Pakistani phone number.
// Mobile: +92 3XX XXXXXXX (the 3XX prefix is a real Pakistani mobile network code).
// Landline: +92 2X XXXXXXX (Karachi=21, Lahore=42, Islamabad=51, etc.)
const PK_MOBILE_PREFIXES = [
  "300", "301", "302", "303", "304", "305", "306", "307", "308", "309", // Jazz
  "310", "311", "312", "313", "314", "315", "316", "317", "318", "319", // Zong
  "320", "321", "322", "323", "324", "325", "326", "327", "328", "329", // Telenor
  "330", "331", "332", "333", "334", "335", "336", "337", "338", "339", // Ufone
];
const PK_LANDLINE_CODES = ["21", "42", "51", "41", "46", "22", "81", "61", "40", "91"];

export function pkPhone(rng: () => number): string {
  // ~70% mobile, ~30% landline
  if (rng() < 0.7) {
    const prefix = PK_MOBILE_PREFIXES[Math.floor(rng() * PK_MOBILE_PREFIXES.length)];
    const rest = String(Math.floor(rng() * 10000000)).padStart(7, "0");
    return `${PK_INFO.dial} ${prefix} ${rest}`;
  }
  const code = PK_LANDLINE_CODES[Math.floor(rng() * PK_LANDLINE_CODES.length)];
  const rest = String(Math.floor(rng() * 10000000)).padStart(7, "0");
  return `${PK_INFO.dial} ${code} ${rest}`;
}

// Pick a random element from an array using the provided RNG.
export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
