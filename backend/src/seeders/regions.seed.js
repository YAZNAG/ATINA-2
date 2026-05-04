const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const regions = [
    { code: "01", name_fr: "Tanger-Tétouan-Al Hoceïma", name_ar: "طنجة-تطوان-الحسيمة" },
    { code: "02", name_fr: "L’Oriental", name_ar: "الشرق" },
    { code: "03", name_fr: "Fès-Meknès", name_ar: "فاس-مكناس" },
    { code: "04", name_fr: "Rabat-Salé-Kénitra", name_ar: "الرباط-سلا-القنيطرة" },
    { code: "05", name_fr: "Béni Mellal-Khénifra", name_ar: "بني ملال-خنيفرة" },
    { code: "06", name_fr: "Casablanca-Settat", name_ar: "الدار البيضاء-سطات" },
    { code: "07", name_fr: "Marrakech-Safi", name_ar: "مراكش-آسفي" },
    { code: "08", name_fr: "Drâa-Tafilalet", name_ar: "درعة-تافيلالت" },
    { code: "09", name_fr: "Souss-Massa", name_ar: "سوس-ماسة" },
    { code: "10", name_fr: "Guelmim-Oued Noun", name_ar: "كلميم-واد نون" },
    { code: "11", name_fr: "Laâyoune-Sakia El Hamra", name_ar: "العيون-الساقية الحمراء" },
    { code: "12", name_fr: "Dakhla-Oued Ed-Dahab", name_ar: "الداخلة-وادي الذهب" }
  ];

  for (const region of regions) {
    await prisma.region.create({ data: region });
  }

  console.log("✅ Régions insérées");
}

main();