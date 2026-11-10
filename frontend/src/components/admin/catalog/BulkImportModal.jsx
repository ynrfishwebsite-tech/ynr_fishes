import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { useLanguage } from '../../../context/LanguageContext';

const SAMPLE_10_ITEMS = [
  { name: 'Rohu (రోహు)', scientificName: 'Labeo rohita', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 150, wholesalePricePerKg: 110, exportPricePerKg: 110, smallPrice: 150, smallWholesalePrice: 110, smallExportPrice: 110, mediumPrice: 170, mediumWholesalePrice: 120, mediumExportPrice: 120, bigPrice: 190, bigWholesalePrice: 140, bigExportPrice: 140, cuttingEnabled: 'TRUE', cuttingCharge: 15, smallCuttingCharge: 10, mediumCuttingCharge: 15, bigCuttingCharge: 20, description: 'Fresh river Rohu fish, sweet water catch', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/rohu.png' },
  { name: 'Katla (బొచ్చె / కాట్లా)', scientificName: 'Gibelion catla', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 220, wholesalePricePerKg: 170, exportPricePerKg: 150, smallPrice: 220, smallWholesalePrice: 170, smallExportPrice: 150, mediumPrice: 240, mediumWholesalePrice: 190, mediumExportPrice: 170, bigPrice: 280, bigWholesalePrice: 210, bigExportPrice: 190, cuttingEnabled: 'TRUE', cuttingCharge: 15, smallCuttingCharge: 10, mediumCuttingCharge: 15, bigCuttingCharge: 20, description: 'Live sweet water Katla, premium weight', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/katla.png' },
  { name: 'Red Prawns / రొయ్యలు', scientificName: 'Penaeus monodon', category: 'Sea Water', speciesType: 'Prawn', sellingUnit: 'Kg', price: 350, wholesalePricePerKg: 260, exportPricePerKg: 240, smallPrice: 350, smallWholesalePrice: 260, smallExportPrice: 240, mediumPrice: 390, mediumWholesalePrice: 290, mediumExportPrice: 260, bigPrice: 440, bigWholesalePrice: 330, bigExportPrice: 300, cuttingEnabled: 'FALSE', cuttingCharge: 0, smallCuttingCharge: 0, mediumCuttingCharge: 0, bigCuttingCharge: 0, description: 'Sea & river fresh prawns, counts 20/30/40', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/red_prawns.jpg' },
  { name: 'Basa Fish / పంగస్', scientificName: 'Pangasius bocourti', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 150, wholesalePricePerKg: 110, exportPricePerKg: 110, smallPrice: 150, smallWholesalePrice: 110, smallExportPrice: 110, mediumPrice: 170, mediumWholesalePrice: 120, mediumExportPrice: 120, bigPrice: 190, bigWholesalePrice: 140, bigExportPrice: 140, cuttingEnabled: 'TRUE', cuttingCharge: 10, smallCuttingCharge: 10, mediumCuttingCharge: 10, bigCuttingCharge: 15, description: 'Boneless white meat Pangas/Basa fish', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/basa_pangas.png' },
  { name: 'White Pomfret (తెల్ల చందువా)', scientificName: 'Pampus argenteus', category: 'Sea Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 1500, wholesalePricePerKg: 1130, exportPricePerKg: 1050, smallPrice: 1500, smallWholesalePrice: 1130, smallExportPrice: 1050, mediumPrice: 1650, mediumWholesalePrice: 1240, mediumExportPrice: 1160, bigPrice: 1880, bigWholesalePrice: 1410, bigExportPrice: 1310, cuttingEnabled: 'TRUE', cuttingCharge: 20, smallCuttingCharge: 20, mediumCuttingCharge: 25, bigCuttingCharge: 30, description: 'Premium grade white pomfret, Vizag harbor direct', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/white_pomfret.png' },
  { name: 'Vanjaram / King Fish (వంజరం)', scientificName: 'Scomberomorus commerson', category: 'Sea Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 850, wholesalePricePerKg: 720, exportPricePerKg: 680, smallPrice: 850, smallWholesalePrice: 720, smallExportPrice: 680, mediumPrice: 950, mediumWholesalePrice: 800, mediumExportPrice: 750, bigPrice: 1100, bigWholesalePrice: 900, bigExportPrice: 850, cuttingEnabled: 'TRUE', cuttingCharge: 25, smallCuttingCharge: 20, mediumCuttingCharge: 25, bigCuttingCharge: 35, description: 'King mackerel large catch, ideal for fry & curry', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/vanjaram_kingfish.jpg' },
  { name: 'Tilapia / Pilot (తిలాపియా)', scientificName: 'Oreochromis niloticus', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 100, wholesalePricePerKg: 85, exportPricePerKg: 80, smallPrice: 100, smallWholesalePrice: 85, smallExportPrice: 80, mediumPrice: 110, mediumWholesalePrice: 95, mediumExportPrice: 90, bigPrice: 130, bigWholesalePrice: 110, bigExportPrice: 100, cuttingEnabled: 'TRUE', cuttingCharge: 10, smallCuttingCharge: 10, mediumCuttingCharge: 10, bigCuttingCharge: 15, description: 'Firm fresh water Tilapia/Jilebi fish', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/tilapia_jalebi.png' },
  { name: 'Korramenu / Murrel Live (కొర్రమీను)', scientificName: 'Channa striata', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 400, wholesalePricePerKg: 340, exportPricePerKg: 320, smallPrice: 400, smallWholesalePrice: 340, smallExportPrice: 320, mediumPrice: 450, mediumWholesalePrice: 380, mediumExportPrice: 360, bigPrice: 500, bigWholesalePrice: 420, bigExportPrice: 400, cuttingEnabled: 'TRUE', cuttingCharge: 20, smallCuttingCharge: 20, mediumCuttingCharge: 20, bigCuttingCharge: 20, description: 'High-protein predatory live Murrel fish', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/korramenu_murrel.png' },
  { name: 'Sea Crabs / పీతలు', scientificName: 'Portunus pelagicus', category: 'Sea Water', speciesType: 'Crab', sellingUnit: 'Kg', price: 350, wholesalePricePerKg: 300, exportPricePerKg: 280, smallPrice: 350, smallWholesalePrice: 300, smallExportPrice: 280, mediumPrice: 390, mediumWholesalePrice: 330, mediumExportPrice: 310, bigPrice: 450, bigWholesalePrice: 380, bigExportPrice: 350, cuttingEnabled: 'FALSE', cuttingCharge: 0, smallCuttingCharge: 0, mediumCuttingCharge: 0, bigCuttingCharge: 0, description: 'Live blue swimming sea crabs', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/sea_crabs.jpg' },
  { name: 'Wallago / వాలగ (ఆల)', scientificName: 'Wallago attu', category: 'Fresh Water', speciesType: 'Fish', sellingUnit: 'Kg', price: 200, wholesalePricePerKg: 170, exportPricePerKg: 160, smallPrice: 200, smallWholesalePrice: 170, smallExportPrice: 160, mediumPrice: 230, mediumWholesalePrice: 190, mediumExportPrice: 180, bigPrice: 260, bigWholesalePrice: 220, bigExportPrice: 200, cuttingEnabled: 'TRUE', cuttingCharge: 15, smallCuttingCharge: 10, mediumCuttingCharge: 15, bigCuttingCharge: 20, description: 'Fresh water river shark Wallago / Valuga fish', isAvailable: 'TRUE', image: 'https://ik.imagekit.io/uy5estwss/menus/wallago_valuga.png' }
];

const SAMPLE_SWEETS = [
  {
    "name": "Gulab Jamun",
    "category": "Indian Sweets",
    "pricePerKg": 400,
    "piecesPerKg": 25,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Soft milk solid dumplings soaked in sugar syrup",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Gulab_Jamun_indian_Sweet.jpg/500px-Gulab_Jamun_indian_Sweet.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Rasgulla",
    "category": "Indian Sweets",
    "pricePerKg": 350,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Spongy cottage cheese balls in syrup",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Rasgulla_preparation_for_Indian_wedding_09.jpg/500px-Rasgulla_preparation_for_Indian_wedding_09.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Rasmalai",
    "category": "Indian Sweets",
    "pricePerKg": 500,
    "piecesPerKg": 15,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Cottage cheese discs in sweetened milk",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Rasmalai_Secretlondon_09.jpg/500px-Rasmalai_Secretlondon_09.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Kaju Katli",
    "category": "Indian Sweets",
    "pricePerKg": 1000,
    "piecesPerKg": 40,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Premium cashew fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Kaju_katli.JPG/500px-Kaju_katli.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Kaju Roll",
    "category": "Indian Sweets",
    "pricePerKg": 1100,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Cashew roll stuffed with pistachios",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Picture_of_tasty_Kaju_katli.JPG/500px-Picture_of_tasty_Kaju_katli.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Motichoor Laddu",
    "category": "Indian Sweets",
    "pricePerKg": 400,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Fine gram flour pearl laddoos",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Moti_Choor_Ke_Laddu.jpg/500px-Moti_Choor_Ke_Laddu.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Besan Laddu",
    "category": "Indian Sweets",
    "pricePerKg": 450,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Roasted gram flour and ghee laddoos",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Pistachio_Besan_Ladoo.JPG/500px-Pistachio_Besan_Ladoo.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Boondi Laddu",
    "category": "Indian Sweets",
    "pricePerKg": 380,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Gram flour pearl laddoos",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Sweet_Mithai%2C_Laddoo_and_Mixture_%28Boondi_Mitai%2C_Laddu_and_Karapusa%29.JPG/500px-Sweet_Mithai%2C_Laddoo_and_Mixture_%28Boondi_Mitai%2C_Laddu_and_Karapusa%29.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Mysore Pak",
    "category": "Indian Sweets",
    "pricePerKg": 600,
    "piecesPerKg": 25,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Rich ghee-based gram flour sweet",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Mysore_Pak_~_Traditional_Indian_sweet_made_from_concoction_of_gram_flour%2C_clarified_butter_and_powdered_sugar.JPG/500px-Mysore_Pak_~_Traditional_Indian_sweet_made_from_concoction_of_gram_flour%2C_clarified_butter_and_powdered_sugar.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Badusha",
    "category": "Indian Sweets",
    "pricePerKg": 400,
    "piecesPerKg": 22,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Flaky deep-fried sweet with sugar glaze",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c6/Badusha_Sweet_by_Preeti_Tamilarasan.jpg/500px-Badusha_Sweet_by_Preeti_Tamilarasan.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Jalebi",
    "category": "Indian Sweets",
    "pricePerKg": 300,
    "piecesPerKg": 30,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Crispy deep-fried spirals in sugar syrup",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Soan Papdi",
    "category": "Indian Sweets",
    "pricePerKg": 350,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Flaky sweet made with gram flour and ghee",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Peda",
    "category": "Indian Sweets",
    "pricePerKg": 500,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Soft milk fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Kalakand",
    "category": "Indian Sweets",
    "pricePerKg": 550,
    "piecesPerKg": 25,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Milk and cottage cheese fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Milk Cake",
    "category": "Indian Sweets",
    "pricePerKg": 600,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Rich grainy milk fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Dharwad Peda",
    "category": "Indian Sweets",
    "pricePerKg": 550,
    "piecesPerKg": 30,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Caramelized milk fudge from Dharwad",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Malai Peda",
    "category": "Indian Sweets",
    "pricePerKg": 520,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Creamy milk fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Coconut Burfi",
    "category": "Indian Sweets",
    "pricePerKg": 400,
    "piecesPerKg": 30,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Fresh coconut fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Besan Burfi",
    "category": "Indian Sweets",
    "pricePerKg": 450,
    "piecesPerKg": 30,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Gram flour fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Kaju Burfi",
    "category": "Indian Sweets",
    "pricePerKg": 1000,
    "piecesPerKg": 40,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Cashew fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Gulab-jamun-wallpaper-1.jpg/400px-Gulab-jamun-wallpaper-1.jpg"
  },
  {
    "name": "Dry Fruit Burfi",
    "category": "Indian Sweets",
    "pricePerKg": 1200,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Mixed dry fruits fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/85/Kaju_katli.JPG/500px-Kaju_katli.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Dodha Burfi",
    "category": "Indian Sweets",
    "pricePerKg": 600,
    "piecesPerKg": 25,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Punjabi milk fudge with nuts",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/26/Dodha_Burfi_-_Howrah_2016-01-26_9262.JPG/500px-Dodha_Burfi_-_Howrah_2016-01-26_9262.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Chum Chum",
    "category": "Indian Sweets",
    "pricePerKg": 450,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Bengali cottage cheese sweet",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b6/Chum_Phon_Gate_%28I%29.jpg/500px-Chum_Phon_Gate_%28I%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Cham Cham",
    "category": "Indian Sweets",
    "pricePerKg": 450,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Bengali cottage cheese sweet",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e8/Cham_des_Bondons_Puech_Mariette.jpg/500px-Cham_des_Bondons_Puech_Mariette.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Sandesh",
    "category": "Indian Sweets",
    "pricePerKg": 500,
    "piecesPerKg": 25,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Bengali sweet made of chenna",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Display_of_Indian_Sweets_Mithai_in_Kolkata%2C_West_Bengal.jpg/500px-Display_of_Indian_Sweets_Mithai_in_Kolkata%2C_West_Bengal.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Kaju Anjeer Roll",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 1200,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Cashew roll stuffed with figs",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/Picture_of_tasty_Kaju_katli.JPG/500px-Picture_of_tasty_Kaju_katli.JPG?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Badam Burfi",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 1100,
    "piecesPerKg": 40,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Almond fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/22/Badam_Barfi.jpg/500px-Badam_Barfi.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail"
  },
  {
    "name": "Pista Burfi",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 1300,
    "piecesPerKg": 40,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Pistachio fudge",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/400px-Kaju_katli_sweet.jpg"
  },
  {
    "name": "Dry Fruit Laddu",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 1000,
    "piecesPerKg": 20,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Laddu made entirely of dry fruits and dates",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/400px-Kaju_katli_sweet.jpg"
  },
  {
    "name": "Anjeer Roll",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 1100,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Fig and nut roll",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/400px-Kaju_katli_sweet.jpg"
  },
  {
    "name": "Dates & Nuts Roll",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 900,
    "piecesPerKg": 30,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Sugar-free dates and nuts roll",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/400px-Kaju_katli_sweet.jpg"
  },
  {
    "name": "Dry Fruit Halwa",
    "category": "Dry Fruit Sweets",
    "pricePerKg": 800,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Chewy halwa loaded with nuts",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ac/Kaju_katli_sweet.jpg/400px-Kaju_katli_sweet.jpg"
  },
  {
    "name": "Rabri",
    "category": "Milk-Based Sweets",
    "pricePerKg": 600,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Thickened sweetened milk",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Mathura_ke_pede.jpg/400px-Mathura_ke_pede.jpg"
  },
  {
    "name": "Basundi",
    "category": "Milk-Based Sweets",
    "pricePerKg": 550,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Sweetened condensed milk",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Mathura_ke_pede.jpg/400px-Mathura_ke_pede.jpg"
  },
  {
    "name": "Doodh Peda",
    "category": "Milk-Based Sweets",
    "pricePerKg": 500,
    "piecesPerKg": 35,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Classic milk peda",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Mathura_ke_pede.jpg/400px-Mathura_ke_pede.jpg"
  },
  {
    "name": "Chhena Poda",
    "category": "Milk-Based Sweets",
    "pricePerKg": 550,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Baked cottage cheese dessert from Odisha",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/38/Mathura_ke_pede.jpg/400px-Mathura_ke_pede.jpg"
  },
  {
    "name": "Tirunelveli Halwa",
    "category": "Halwa",
    "pricePerKg": 450,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Wheat halwa made with ghee",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Bombay Halwa",
    "category": "Halwa",
    "pricePerKg": 350,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Chewy corn flour halwa",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Karachi Halwa",
    "category": "Halwa",
    "pricePerKg": 350,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Chewy colorful corn flour halwa",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Gajar Halwa",
    "category": "Halwa",
    "pricePerKg": 400,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Carrot pudding with nuts and ghee",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Badam Halwa",
    "category": "Halwa",
    "pricePerKg": 1200,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Rich almond pudding",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Sooji Halwa",
    "category": "Halwa",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Semolina pudding",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Moong Dal Halwa",
    "category": "Halwa",
    "pricePerKg": 500,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Rich moong lentil pudding",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Gajar_halwa.jpg/400px-Gajar_halwa.jpg"
  },
  {
    "name": "Mixture",
    "category": "Snacks",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Classic spicy mixture",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Kara Boondi",
    "category": "Snacks",
    "pricePerKg": 280,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Spicy gram flour pearls",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Masala Boondi",
    "category": "Snacks",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Spicy boondi with peanuts and curry leaves",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Sev",
    "category": "Snacks",
    "pricePerKg": 280,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Crispy gram flour noodles",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Murukku",
    "category": "Snacks",
    "pricePerKg": 320,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Crispy rice flour spirals",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Chakli",
    "category": "Snacks",
    "pricePerKg": 320,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Crispy spiral snack",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Ribbon Pakoda",
    "category": "Snacks",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Ribbon-shaped crispy snack",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Nippattu",
    "category": "Snacks",
    "pricePerKg": 320,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Spicy rice flour crackers",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Chekkalu",
    "category": "Snacks",
    "pricePerKg": 320,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Spicy rice crackers from Andhra",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Cashew Mixture",
    "category": "Snacks",
    "pricePerKg": 450,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Premium mixture with cashews",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Peanut Mixture",
    "category": "Snacks",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Spicy mixture with peanuts",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/02/Namkeen-mixture.jpg/400px-Namkeen-mixture.jpg"
  },
  {
    "name": "Samosa",
    "category": "Bakery & Fried",
    "pricePerKg": 250,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Potato-stuffed pastry",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Kachori",
    "category": "Bakery & Fried",
    "pricePerKg": 300,
    "piecesPerKg": 12,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Spicy dal-stuffed pastry",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Bajji",
    "category": "Bakery & Fried",
    "pricePerKg": 200,
    "piecesPerKg": 15,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Vegetable fritters",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Bonda",
    "category": "Bakery & Fried",
    "pricePerKg": 220,
    "piecesPerKg": 12,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Potato fritters",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Mirchi Bajji",
    "category": "Bakery & Fried",
    "pricePerKg": 250,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Chilli fritters",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Pakoda",
    "category": "Bakery & Fried",
    "pricePerKg": 300,
    "piecesPerKg": 0,
    "sellByWeight": "TRUE",
    "sellByPiece": "FALSE",
    "type": "Veg",
    "description": "Onion and gram flour fritters",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Veg Puff",
    "category": "Bakery & Fried",
    "pricePerKg": 350,
    "piecesPerKg": 15,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Flaky puff pastry with veg filling",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Egg Puff",
    "category": "Bakery & Fried",
    "pricePerKg": 400,
    "piecesPerKg": 15,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Egg",
    "description": "Flaky puff pastry with egg filling",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Cream Bun",
    "category": "Bakery & Fried",
    "pricePerKg": 250,
    "piecesPerKg": 12,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Sweet bun filled with cream",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Cake (Slice)",
    "category": "Bakery & Fried",
    "pricePerKg": 600,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Assorted cake slices",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Pastries",
    "category": "Bakery & Fried",
    "pricePerKg": 800,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Assorted pastries",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/29/Samosachutney.jpg/400px-Samosachutney.jpg"
  },
  {
    "name": "Vanilla Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 300,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Classic vanilla ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Chocolate Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 350,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Rich chocolate ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Butterscotch Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 350,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Butterscotch ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Strawberry Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 300,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Strawberry ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Pista Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 400,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Pistachio ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Mango Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 350,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Mango ice cream scoop",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Kulfi",
    "category": "Ice Cream",
    "pricePerKg": 400,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Traditional Indian ice cream",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Falooda",
    "category": "Ice Cream",
    "pricePerKg": 400,
    "piecesPerKg": 5,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Sweet beverage with vermicelli and ice cream",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Fruit Salad with Ice Cream",
    "category": "Ice Cream",
    "pricePerKg": 450,
    "piecesPerKg": 5,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Fresh fruits topped with ice cream",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Ice Cream Cake",
    "category": "Ice Cream",
    "pricePerKg": 800,
    "piecesPerKg": 10,
    "sellByWeight": "TRUE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Cake made with ice cream layers",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Scoops_of_ice_cream_in_a_bowl.jpg/400px-Scoops_of_ice_cream_in_a_bowl.jpg"
  },
  {
    "name": "Tea",
    "category": "Beverages",
    "pricePerKg": 200,
    "piecesPerKg": 15,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Hot Indian chai",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Coffee",
    "category": "Beverages",
    "pricePerKg": 300,
    "piecesPerKg": 15,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Hot filter coffee",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Badam Milk",
    "category": "Beverages",
    "pricePerKg": 400,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Almond flavored milk",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Rose Milk",
    "category": "Beverages",
    "pricePerKg": 350,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Rose flavored chilled milk",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Lassi",
    "category": "Beverages",
    "pricePerKg": 300,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Sweetened yogurt drink",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Buttermilk",
    "category": "Beverages",
    "pricePerKg": 200,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Spiced buttermilk (Chaas)",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Fresh Juice (Seasonal)",
    "category": "Beverages",
    "pricePerKg": 400,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Freshly squeezed fruit juice",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Milkshake",
    "category": "Beverages",
    "pricePerKg": 450,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Thick flavored milkshake",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Cold Drink (Soda)",
    "category": "Beverages",
    "pricePerKg": 250,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Carbonated beverage",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  },
  {
    "name": "Bottled Water",
    "category": "Beverages",
    "pricePerKg": 200,
    "piecesPerKg": 10,
    "sellByWeight": "FALSE",
    "sellByPiece": "TRUE",
    "type": "Veg",
    "description": "Packaged drinking water",
    "isAvailable": "TRUE",
    "image": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/Tea-1_ubt.jpeg/400px-Tea-1_ubt.jpeg"
  }
];

export const generateExcelWithStyling = async (items, filename = 'YNR_Fishes_Catalog_Template.xlsx') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Fish Catalog', {
    views: [{ showGridLines: true }]
  });

  const columnsConfig = [
    { header: 'Fish Name', key: 'name', minWidth: 24 },
    { header: 'Scientific Name', key: 'scientificName', minWidth: 20 },
    { header: 'Item Image', key: 'image', minWidth: 35 },
    { header: 'Water Environment', key: 'category', minWidth: 18 },
    { header: 'Seafood Species', key: 'speciesType', minWidth: 18 },
    { header: 'Selling Unit', key: 'sellingUnit', minWidth: 14 },
    { header: 'Retail Price (₹/Kg)', key: 'price', minWidth: 20 },
    { header: 'Wholesale Price (₹/Kg)', key: 'wholesalePricePerKg', minWidth: 22 },
    { header: 'Export Price (₹/Kg)', key: 'exportPricePerKg', minWidth: 20 },
    { header: 'Small Retail (₹/Kg)', key: 'smallPrice', minWidth: 18 },
    { header: 'Small Wholesale (₹/Kg)', key: 'smallWholesalePrice', minWidth: 22 },
    { header: 'Small Export (₹/Kg)', key: 'smallExportPrice', minWidth: 20 },
    { header: 'Medium Retail (₹/Kg)', key: 'mediumPrice', minWidth: 18 },
    { header: 'Medium Wholesale (₹/Kg)', key: 'mediumWholesalePrice', minWidth: 24 },
    { header: 'Medium Export (₹/Kg)', key: 'mediumExportPrice', minWidth: 22 },
    { header: 'Big Retail (₹/Kg)', key: 'bigPrice', minWidth: 18 },
    { header: 'Big Wholesale (₹/Kg)', key: 'bigWholesalePrice', minWidth: 22 },
    { header: 'Big Export (₹/Kg)', key: 'bigExportPrice', minWidth: 20 },
    { header: 'Cutting Charges Enabled', key: 'cuttingEnabled', minWidth: 22 },
    { header: 'Base Cutting Charge (₹)', key: 'cuttingCharge', minWidth: 22 },
    { header: 'Small Cutting Charge (₹)', key: 'smallCuttingCharge', minWidth: 22 },
    { header: 'Medium Cutting Charge (₹)', key: 'mediumCuttingCharge', minWidth: 24 },
    { header: 'Big Cutting Charge (₹)', key: 'bigCuttingCharge', minWidth: 22 },
    { header: 'Description', key: 'description', minWidth: 30 },
  ];

  worksheet.columns = columnsConfig.map(c => ({
    header: c.header,
    key: c.key,
    width: c.minWidth
  }));

  // Add all items as data rows
  items.forEach(item => worksheet.addRow(item));

  // Style Header Row (Oceanic Deep Teal #06395A with Cyan Accent #3DC0CC border)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '06395A' } }; // Premium Ocean Blue
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: '022338' } },
      bottom: { style: 'medium', color: { argb: '3DC0CC' } }, // Cyan highlight line
      left: { style: 'thin', color: { argb: '0A4E7A' } },
      right: { style: 'thin', color: { argb: '0A4E7A' } }
    };
  });

  // Style Data Rows with Premium Alternating Colors (Clean White vs Crisp Aqua Tint #EAF5F8)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.height = 26;
    const isEven = rowNumber % 2 === 0;
    const rowBgColor = isEven ? 'EAF5F8' : 'FFFFFF'; // Alternating high-legibility aqua-white zebra stripe

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: '0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      
      // Numbers right-aligned, units/status centered, names left-aligned
      const isNumeric = colNumber === 5 || colNumber === 6 || colNumber === 8 || colNumber === 9;
      const isCenter = colNumber === 4 || colNumber === 11;
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumeric ? 'right' : isCenter ? 'center' : 'left',
        wrapText: true
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'CFE2E8' } },
        bottom: { style: 'thin', color: { argb: 'CFE2E8' } },
        left: { style: 'thin', color: { argb: 'CFE2E8' } },
        right: { style: 'thin', color: { argb: 'CFE2E8' } }
      };
    });
  });

  // Dynamic Column Width: Calculate maximum content length per column + padding
  worksheet.columns.forEach((column) => {
    let maxContentLen = 0;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellVal = cell.value ? String(cell.value) : '';
      if (cellVal.length > maxContentLen) {
        maxContentLen = cellVal.length;
      }
    });
    // Set dynamic width with safety bounds [min, max 60]
    const calculatedWidth = Math.max(maxContentLen + 4, column.width || 15);
    column.width = Math.min(calculatedWidth, 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const BulkImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  const sweetFileInputRef = useRef(null);
  const [importMode, setImportMode] = useState('restaurant'); // 'restaurant' | 'sweets'
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showGuide, setShowGuide] = useState(true);

  if (!isOpen) return null;

  const handleDownloadSampleExcel = () => {
    generateExcelWithStyling(SAMPLE_10_ITEMS, 'YNR_Fishes_Catalog_Template.xlsx');
  };

  const handleDownloadSweetExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sweet Items');
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Price Per Kg', key: 'pricePerKg', width: 15 },
      { header: 'Pieces Per Kg', key: 'piecesPerKg', width: 15 },
      { header: 'Sell By Weight', key: 'sellByWeight', width: 15 },
      { header: 'Sell By Piece', key: 'sellByPiece', width: 14 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Is Available', key: 'isAvailable', width: 14 },
      { header: 'Image URL', key: 'image', width: 45 },
    ];
    SAMPLE_SWEETS.forEach(item => worksheet.addRow(item));
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D97706' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'YNR_Fishes_Sweets_Template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSampleCSV = () => {
    const csvContent = Papa.unparse(SAMPLE_10_ITEMS.map(i => ({
      'Fish Name': i.name,
      'Scientific Name': i.scientificName || '',
      'Item Image': i.image || '',
      'Water Environment': i.category,
      'Seafood Species': i.speciesType || 'Fish',
      'Selling Unit': i.sellingUnit || 'Kg',
      'Retail Price (₹/Kg)': i.price,
      'Wholesale Price (₹/Kg)': i.wholesalePricePerKg || Math.round(i.price * 0.85),
      'Export Price (₹/Kg)': i.exportPricePerKg || Math.round(i.price * 0.8),
      'Small Retail (₹/Kg)': i.smallPrice || i.price,
      'Small Wholesale (₹/Kg)': i.smallWholesalePrice || i.wholesalePricePerKg || Math.round(i.price * 0.85),
      'Small Export (₹/Kg)': i.smallExportPrice || i.exportPricePerKg || Math.round(i.price * 0.8),
      'Medium Retail (₹/Kg)': i.mediumPrice || Math.round(i.price * 1.1),
      'Medium Wholesale (₹/Kg)': i.mediumWholesalePrice || Math.round((i.wholesalePricePerKg || i.price) * 1.1),
      'Medium Export (₹/Kg)': i.mediumExportPrice || Math.round((i.exportPricePerKg || i.price) * 1.1),
      'Big Retail (₹/Kg)': i.bigPrice || Math.round(i.price * 1.25),
      'Big Wholesale (₹/Kg)': i.bigWholesalePrice || Math.round((i.wholesalePricePerKg || i.price) * 1.25),
      'Big Export (₹/Kg)': i.bigExportPrice || Math.round((i.exportPricePerKg || i.price) * 1.25),
      'Cutting Charges Enabled': i.cuttingEnabled || 'TRUE',
      'Base Cutting Charge (₹)': i.cuttingCharge || 0,
      'Small Cutting Charge (₹)': i.smallCuttingCharge || i.cuttingCharge || 0,
      'Medium Cutting Charge (₹)': i.mediumCuttingCharge || i.cuttingCharge || 0,
      'Big Cutting Charge (₹)': i.bigCuttingCharge || i.cuttingCharge || 0,
      'Description': i.description || ''
    })));
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'YNR_Fishes_Catalog_Template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const parseExcelFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('No worksheets found in Excel file');

      const rows = [];
      let headers = [];

      worksheet.eachRow((row, rowNumber) => {
        const rowValues = row.values.slice(1); // 1-indexed in ExcelJS
        if (rowNumber === 1) {
          headers = rowValues.map(v => v ? String(v).trim() : '');
        } else {
          const rowObj = {};
          headers.forEach((header, idx) => {
            if (header) {
              rowObj[header] = rowValues[idx] !== undefined && rowValues[idx] !== null ? String(rowValues[idx]).trim() : '';
            }
          });
          if (Object.values(rowObj).some(v => v !== '')) {
            rows.push(rowObj);
          }
        }
      });

      return rows;
    } catch (err) {
      console.error('Error reading excel:', err);
      throw new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    }
  };

  const parseCSVFile = (file) => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (err) => reject(err)
      });
    });
  };

  const processFile = async (file) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (fileExt !== 'csv' && fileExt !== 'xlsx' && fileExt !== 'xls') {
      setErrorMsg('Unsupported file format. Please upload a .csv or .xlsx file.');
      return;
    }

    setSelectedFile(file);
    setIsParsing(true);
    setErrorMsg('');

    try {
      let rawRows = [];
      if (fileExt === 'csv') {
        rawRows = await parseCSVFile(file);
      } else {
        rawRows = await parseExcelFile(file);
      }

      const processed = rawRows.map((row, index) => {
        // Standardize key names flexible to case
        const getVal = (...keys) => {
          for (let k of keys) {
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey && row[foundKey] !== undefined) return row[foundKey];
          }
          return '';
        };

        const name = getVal('Fish Name', 'Name', 'Item Name', 'ItemName');
        const scientificName = getVal('Scientific Name', 'ScientificName', 'Scientific');
        const category = getVal('Water Environment', 'Water Environment *', 'Category', 'Category Name', 'Environment') || 'Sea Water';
        const sellingUnit = getVal('Selling Unit', 'SellingUnit', 'Unit') || 'Kg';
        const purchasePriceRaw = getVal('Purchase Price (₹/Kg)', 'Purchase Price', 'PurchasePrice', 'Reference Buying Rate', 'Cost Price', 'Cost');
        const priceRaw = getVal('Retail Price (₹/Kg)', 'Retail Price', 'RetailPrice', 'Selling Price (₹/Kg)', 'Selling Price', 'Price', 'Item Price', 'Rate');
        const openingStockRaw = getVal('Opening Stock (Kg)', 'Opening Stock', 'OpeningStock', 'Stock');
        const description = getVal('Description', 'Item Description');
        const isAvailableRaw = getVal('Is Available', 'IsAvailable', 'Available');
        const taxRateRaw = getVal('Tax Rate', 'TaxRate', 'Tax');
        const image = getVal('Item Image', 'Item Image (Optional)', 'Image URL', 'ImageURL', 'Image', 'Photo');

        // Sweet shop specific fields
        const pricePerKgRaw = getVal('Price Per Kg', 'PricePerKg', 'Price/Kg');
        const piecesPerKgRaw = getVal('Pieces Per Kg', 'PiecesPerKg', 'Pieces/Kg');
        const sellByWeightRaw = getVal('Sell By Weight', 'SellByWeight');
        const sellByPieceRaw = getVal('Sell By Piece', 'SellByPiece');

        const wholesalePricePerKgRaw = getVal('Wholesale Price', 'WholesalePrice', 'Wholesale Price (₹/Kg)', 'WholesalePricePerKg');
        const exportPricePerKgRaw = getVal('Export Price', 'ExportPrice', 'Export Price (₹/Kg)', 'ExportPricePerKg');
        const waterTypeRaw = getVal('Water Type', 'WaterType', 'Water Environment');
        const speciesTypeRaw = getVal('Seafood Species', 'Species', 'Species Type', 'Seafood Type', 'SpeciesType');

        // Grade-wise Retail Prices
        const smallPriceRaw = getVal('Small Retail (₹/Kg)', 'Small Retail', 'Small Price (₹/Kg)', 'Small Price', 'SmallPrice');
        const mediumPriceRaw = getVal('Medium Retail (₹/Kg)', 'Medium Retail', 'Medium Price (₹/Kg)', 'Medium Price', 'MediumPrice');
        const bigPriceRaw = getVal('Big Retail (₹/Kg)', 'Big Retail', 'Big Price (₹/Kg)', 'Big Price', 'BigPrice');

        // Grade-wise Wholesale Prices
        const smallWholesaleRaw = getVal('Small Wholesale (₹/Kg)', 'Small Wholesale', 'SmallWholesalePrice', 'Small Wholesale Price');
        const mediumWholesaleRaw = getVal('Medium Wholesale (₹/Kg)', 'Medium Wholesale', 'MediumWholesalePrice', 'Medium Wholesale Price');
        const bigWholesaleRaw = getVal('Big Wholesale (₹/Kg)', 'Big Wholesale', 'BigWholesalePrice', 'Big Wholesale Price');

        // Grade-wise Export Prices
        const smallExportRaw = getVal('Small Export (₹/Kg)', 'Small Export', 'SmallExportPrice', 'Small Export Price');
        const mediumExportRaw = getVal('Medium Export (₹/Kg)', 'Medium Export', 'MediumExportPrice', 'Medium Export Price');
        const bigExportRaw = getVal('Big Export (₹/Kg)', 'Big Export', 'BigExportPrice', 'Big Export Price');

        // Cutting & Cleaning Fee Fields
        const cuttingEnabledRaw = getVal('Cutting Charges Enabled', 'Cutting Enabled', 'Cutting Charges', 'Custom Cutting Charges', 'Cutting Charges (ON/OFF)');
        const cuttingChargeRaw = getVal('Base Cutting Charge (₹)', 'Base Cutting Rate', 'Base Cutting', 'Custom Cutting Charge (₹)', 'CuttingCharge', 'Cutting Charge', 'Cutting Rate');
        const smallCuttingChargeRaw = getVal('Small Cutting Charge (₹)', 'Small Cutting Charge', 'SmallCuttingCharge');
        const mediumCuttingChargeRaw = getVal('Medium Cutting Charge (₹)', 'Medium Cutting Charge', 'MediumCuttingCharge');
        const bigCuttingChargeRaw = getVal('Big Cutting Charge (₹)', 'Big Cutting Charge', 'BigCuttingCharge');

        const smallUnitRaw = getVal('Small Unit', 'SmallUnit') || 'kg';
        const mediumUnitRaw = getVal('Medium Unit', 'MediumUnit') || 'kg';
        const bigUnitRaw = getVal('Big Unit', 'BigUnit') || 'kg';

        const price = parseFloat(priceRaw) || 0;
        const wholesalePricePerKg = parseFloat(wholesalePricePerKgRaw) || price;
        const exportPricePerKg = parseFloat(exportPricePerKgRaw) || wholesalePricePerKg;
        const purchasePrice = parseFloat(purchasePriceRaw) || 0;
        const openingStock = parseFloat(openingStockRaw) || 0;
        const taxRate = parseFloat(taxRateRaw) || 0;
        const pricePerKg = parseFloat(pricePerKgRaw) || 0;
        const cuttingCharge = parseFloat(cuttingChargeRaw) || 0;

        const catLower = String(category || '').toLowerCase();
        const nameLower = String(name || '').toLowerCase();
        const waterType = waterTypeRaw ? (String(waterTypeRaw).toLowerCase().includes('fresh') ? 'fresh_water' : 'sea_water') : (catLower.includes('fresh') || catLower.includes('river') || catLower.includes('sweet') ? 'fresh_water' : 'sea_water');
        const speciesType = speciesTypeRaw ? (String(speciesTypeRaw).toLowerCase().includes('prawn') ? 'prawn' : String(speciesTypeRaw).toLowerCase().includes('crab') ? 'crab' : 'fish') : (catLower.includes('prawn') || nameLower.includes('prawn') || nameLower.includes('shrimp') ? 'prawn' : catLower.includes('crab') || nameLower.includes('crab') ? 'crab' : 'fish');

        // Grade mode prices with fallback to main prices
        const smallPrice = parseFloat(smallPriceRaw) || price;
        const smallWholesale = parseFloat(smallWholesaleRaw) || wholesalePricePerKg;
        const smallExport = parseFloat(smallExportRaw) || exportPricePerKg;

        const mediumPrice = parseFloat(mediumPriceRaw) || (price ? Math.round(price * 1.1 / 10) * 10 : 0);
        const mediumWholesale = parseFloat(mediumWholesaleRaw) || (wholesalePricePerKg ? Math.round(wholesalePricePerKg * 1.1 / 10) * 10 : 0);
        const mediumExport = parseFloat(mediumExportRaw) || (exportPricePerKg ? Math.round(exportPricePerKg * 1.1 / 10) * 10 : 0);

        const bigPrice = parseFloat(bigPriceRaw) || (price ? Math.round(price * 1.25 / 10) * 10 : 0);
        const bigWholesale = parseFloat(bigWholesaleRaw) || (wholesalePricePerKg ? Math.round(wholesalePricePerKg * 1.25 / 10) * 10 : 0);
        const bigExport = parseFloat(bigExportRaw) || (exportPricePerKg ? Math.round(exportPricePerKg * 1.25 / 10) * 10 : 0);

        // Grade cutting charges cascade to base cutting fee
        const smallCuttingCharge = smallCuttingChargeRaw !== '' && smallCuttingChargeRaw !== undefined
          ? (parseFloat(smallCuttingChargeRaw) || 0)
          : cuttingCharge;
        const mediumCuttingCharge = mediumCuttingChargeRaw !== '' && mediumCuttingChargeRaw !== undefined
          ? (parseFloat(mediumCuttingChargeRaw) || 0)
          : cuttingCharge;
        const bigCuttingCharge = bigCuttingChargeRaw !== '' && bigCuttingChargeRaw !== undefined
          ? (parseFloat(bigCuttingChargeRaw) || 0)
          : cuttingCharge;

        let customCuttingChargeEnabled = false;
        if (cuttingEnabledRaw !== '' && cuttingEnabledRaw !== undefined) {
          const lower = String(cuttingEnabledRaw).trim().toLowerCase();
          customCuttingChargeEnabled = lower === 'true' || lower === 'yes' || lower === 'on' || lower === '1' || lower === 'active';
        } else {
          customCuttingChargeEnabled = cuttingCharge > 0 || smallCuttingCharge > 0 || mediumCuttingCharge > 0 || bigCuttingCharge > 0;
        }

        const piecesPerKg = parseFloat(piecesPerKgRaw) || 0;
        const sellByWeight = sellByWeightRaw && String(sellByWeightRaw).toLowerCase() !== 'false' && sellByWeightRaw !== '0';
        const sellByPiece = sellByPieceRaw && String(sellByPieceRaw).toLowerCase() !== 'false' && sellByPieceRaw !== '0';
        const isSweetsMode = importMode === 'sweets';
        
        const type = 'non-veg';

        let isAvailable = true;
        if (isAvailableRaw) {
          const lowerAvail = String(isAvailableRaw).toLowerCase();
          if (lowerAvail === 'false' || lowerAvail === 'no' || lowerAvail === '0') isAvailable = false;
        }

        const missingFields = [];
        if (!name) missingFields.push('Fish Name');
        if (!category) missingFields.push('Category');
        if (isSweetsMode) {
          if (!pricePerKgRaw || pricePerKg <= 0) missingFields.push('Price Per Kg');
        } else {
          if (!priceRaw || isNaN(price) || price <= 0) missingFields.push('Selling Price');
        }

        const sweetConfig = isSweetsMode ? {
          enabled: true,
          sellByWeight: sellByWeight || true,
          sellByPiece: sellByPiece,
          pricePerKg,
          piecesPerKg
        } : undefined;

        return {
          id: index + 1,
          name,
          scientificName,
          category,
          sellingUnit,
          purchasePrice,
          openingStock,
          price: isSweetsMode ? pricePerKg : price,
          wholesalePricePerKg,
          exportPricePerKg,
          waterType,
          speciesType,
          sizeGrades: {
            small: { minKg: 0, maxKg: 1, price: smallPrice, wholesalePrice: smallWholesale, exportPrice: smallExport, unit: smallUnitRaw.toLowerCase().includes('g') ? 'g' : 'kg', cuttingCharge: smallCuttingCharge, enabled: true },
            medium: { minKg: 1, maxKg: 4, price: mediumPrice, wholesalePrice: mediumWholesale, exportPrice: mediumExport, unit: mediumUnitRaw.toLowerCase().includes('g') ? 'g' : 'kg', cuttingCharge: mediumCuttingCharge, enabled: true },
            big: { minKg: 4, maxKg: 99, price: bigPrice, wholesalePrice: bigWholesale, exportPrice: bigExport, unit: bigUnitRaw.toLowerCase().includes('g') ? 'g' : 'kg', cuttingCharge: bigCuttingCharge, enabled: true }
          },
          customCuttingChargeEnabled,
          cuttingCharge,
          type,
          description,
          isAvailable,
          taxRate,
          image,
          pricePerKg,
          piecesPerKg,
          sellByWeight,
          sellByPiece,
          sweetConfig,
          isValid: missingFields.length === 0,
          missingFields,
          rawRow: row
        };
      });

      setParsedData(processed);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read file contents.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleConfirmImport = async () => {
    const validItems = parsedData.filter(d => d.isValid);
    if (validItems.length === 0) {
      setErrorMsg('No valid items found to import.');
      return;
    }

    setIsImporting(true);
    setErrorMsg('');

    try {
      await onImportSuccess(validItems);
      handleReset();
      onClose();
    } catch (err) {
      setErrorMsg('An error occurred while importing items: ' + (err.message || 'Server error'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData([]);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = parsedData.filter(d => d.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-gradient-to-r from-primary/10 via-surface to-accent/10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
            <div className="p-2 sm:p-2.5 bg-primary/15 text-primary rounded-xl shrink-0">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg md:text-xl font-bold text-text-main leading-tight truncate">{t("Bulk Fish Catalog Import")}</h2>
              <p className="text-[10px] sm:text-xs text-text-muted hidden xs:block truncate">{t("Upload wholesale & retail fish catalog via Excel (.xlsx) or CSV (.csv)")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Download Sample & Guidelines Card */}
          <div className="bg-surface-hover/50 border border-border/70 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className={importMode === 'sweets' ? 'text-amber-500' : 'text-primary'} />
                <span className="text-sm font-semibold text-text-main">
                  {importMode === 'sweets' ? 'Sweet Shop Fields & Format' : t("Fields & Excel Format Requirements")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {importMode === 'sweets' ? (
                  <button onClick={handleDownloadSweetExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                    <Download size={14} />
                    <span>Download Sweet Template .XLSX</span>
                  </button>
                ) : (
                  <>
                    <button onClick={handleDownloadSampleExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-sm">
                      <Download size={14} />
                      <span>{t("Download Sample .XLSX")}</span>
                    </button>
                    <button onClick={handleDownloadSampleCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border text-text-main text-xs font-semibold rounded-lg hover:bg-surface-hover transition-colors">
                      <FileText size={14} />
                      <span>{t("Download Sample .CSV")}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Field Info Pills in Strict Requested Order */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
                <span className="font-black text-slate-900 dark:text-white block">1. Fish Name *</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">e.g. Silver Pomfret, Vanjaram</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">2. Scientific Name</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 italic">e.g. Pampus argenteus</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">3. Item Image (Optional)</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Direct Image URL link</span>
              </div>
              <div className="p-2 bg-sky-50/70 dark:bg-sky-950/40 rounded-lg border border-sky-300 dark:border-sky-800 shadow-2xs">
                <span className="font-black text-sky-800 dark:text-sky-300 block">4. Water Environment *</span>
                <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">Sea Water or Fresh Water</span>
              </div>
              <div className="p-2 bg-amber-50/70 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 shadow-2xs">
                <span className="font-black text-amber-800 dark:text-amber-300 block">5. Seafood Species</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Fish, Prawn, Crab, etc.</span>
              </div>
              <div className="p-2 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-300 dark:border-emerald-800 shadow-2xs">
                <span className="font-black text-emerald-800 dark:text-emerald-400 block">6. Retail Price (₹/Kg) *</span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Walk-in counter selling rate</span>
              </div>
              <div className="p-2 bg-amber-50/70 dark:bg-amber-950/40 rounded-lg border border-amber-300 dark:border-amber-800 shadow-2xs">
                <span className="font-black text-amber-800 dark:text-amber-400 block">7. Wholesale Price (₹/Kg)</span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Market dealer price per Kg</span>
              </div>
              <div className="p-2 bg-blue-50/70 dark:bg-blue-950/40 rounded-lg border border-blue-300 dark:border-blue-800 shadow-2xs">
                <span className="font-black text-blue-800 dark:text-blue-400 block">8. Export Price (₹/Kg)</span>
                <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">Interstate consignment rate</span>
              </div>
              <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">9. Description</span>
                <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Item notes & cut details</span>
              </div>
              <div className="p-2 bg-purple-50/70 dark:bg-purple-950/40 rounded-lg border border-purple-300 dark:border-purple-800 shadow-2xs">
                <span className="font-black text-purple-800 dark:text-purple-300 block">10. Size Grades & Prices</span>
                <span className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">Small, Medium, Big (Retail, Wholesale, Export)</span>
              </div>
              <div className="p-2 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-lg border border-indigo-300 dark:border-indigo-800 shadow-2xs col-span-2">
                <span className="font-black text-indigo-800 dark:text-indigo-300 block">11. Cutting & Cleaning Fees</span>
                <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium">Enabled (TRUE/FALSE), Base rate & Grade fees</span>
              </div>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.xlsx,.xls"
                className="hidden" />
              <div className="p-4 bg-primary/15 text-primary rounded-full shadow-inner">
                <Upload size={32} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main">{t("Click or Drag & Drop File Here")}</h3>
                <p className="text-xs text-text-muted mt-1">{t("Supports both Excel (.xlsx, .xls) and CSV (.csv) files")}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-3.5 bg-surface rounded-xl border border-border gap-2.5">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="p-2 bg-primary/15 text-primary rounded-lg shrink-0">
                  <FileSpreadsheet size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-text-main truncate">{selectedFile.name}</p>
                  <p className="text-[11px] sm:text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.name.split('.').pop().toUpperCase()}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-danger hover:bg-danger/10 rounded-lg transition-colors border border-danger/20 font-semibold shrink-0 w-full sm:w-auto">
                <RefreshCw size={13} />
                <span>{t("Change File")}</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Live Data Preview Table */}
          {parsedData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-main">{t("Live File Preview")}</h3>
                  <span className="px-2.5 py-0.5 bg-primary/15 text-primary text-xs font-bold rounded-full">{parsedData.length} {t("Items")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 font-semibold rounded-full border border-emerald-500/20">
                    <CheckCircle size={12} /> {validCount} {t("Valid")}
                  </span>
                  {invalidCount > 0 && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-600 font-semibold rounded-full border border-amber-500/20">
                      <AlertCircle size={12} /> {invalidCount} {t("Incomplete")}
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container with Horizontal and Vertical Scrolling for Mobile & Desktop */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-sky-400/80 px-1 sm:hidden">
                  <span className="flex items-center gap-1 font-medium animate-pulse">
                    Swipe left / right to view all columns (Price, Stock, Image)
                  </span>
                </div>
                <div className="border border-[#E8DCCB] rounded-xl overflow-hidden shadow-xs max-h-[360px] overflow-y-auto overflow-x-auto overscroll-contain bg-white">
                  <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF6F0] dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-black text-xs uppercase tracking-wider sticky top-0 z-20 border-b-2 border-border shadow-xs">
                        <th className="py-2.5 px-3 w-10 text-center sticky left-0 z-30 bg-[#FAF6F0] dark:bg-slate-900 shadow-[1px_0_0_#eedecb]">#</th>
                        <th className="py-2.5 px-3 w-20 text-center">{t("Status")}</th>
                        <th className="py-2.5 px-3 min-w-[150px]">{t("Fish Name")}</th>
                        <th className="py-2.5 px-3 min-w-[130px]">Scientific Name</th>
                        <th className="py-2.5 px-3 text-center w-16">Image</th>
                        <th className="py-2.5 px-3 min-w-[120px]">{t("Water Environment")}</th>
                        <th className="py-2.5 px-3 text-center w-24">Seafood Species</th>
                        <th className="py-2.5 px-3 text-right w-24 text-emerald-800 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">{t("Retail (₹/Kg)")}</th>
                        <th className="py-2.5 px-3 text-right w-24 text-amber-800 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20">{t("Wholesale (₹/Kg)")}</th>
                        <th className="py-2.5 px-3 text-right w-24 text-blue-800 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20">{t("Export (₹/Kg)")}</th>
                        <th className="py-2.5 px-3 min-w-[140px]">{t("Description")}</th>
                        <th className="py-2.5 px-3 min-w-[170px] text-purple-700 dark:text-purple-300 bg-purple-50/40 dark:bg-purple-950/20">{t("Size Grades (S / M / B)")}</th>
                        <th className="py-2.5 px-3 min-w-[150px] text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20">{t("Cutting Charges")}</th>
                      </tr>
                    </thead>
                  <tbody>
                    {parsedData.map((row, idx) => {
                      // High contrast clean oceanic dark theme row styling
                      const isEven = idx % 2 === 0;
                      const rowBg = !row.isValid
                        ? 'rgba(239, 68, 68, 0.15)'
                        : isEven
                          ? 'rgba(6, 40, 68, 0.45)'
                          : 'rgba(2, 20, 36, 0.7)';

                      return (
                        <tr 
                          key={row.id} 
                          style={{ background: rowBg }}
                          className="transition-colors border-b border-sky-900/30 hover:bg-sky-900/30"
                        >
                          <td 
                            style={{ background: rowBg }} 
                            className="py-2.5 px-3 text-center text-slate-300 font-mono text-[11px] font-bold sticky left-0 z-10 shadow-[1px_0_0_rgba(14,165,233,0.3)]"
                          >
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black rounded-md text-[11px]">
                                <CheckCircle size={11} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black rounded-md text-[11px]" title={`Missing: ${row.missingFields.join(', ')}`}>
                                <AlertCircle size={11} /> Missing
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white text-xs">{row.name || <span className="text-amber-400 italic">Missing</span>}</td>
                          <td className="py-2.5 px-3 text-sky-200/80 italic text-xs font-medium">{row.scientificName || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            {row.image ? (
                              <div className="w-8 h-8 rounded-lg overflow-hidden border border-sky-400/40 mx-auto bg-slate-900/80 shadow-xs flex items-center justify-center">
                                <img
                                  src={row.image}
                                  alt={row.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement.innerHTML = '<span class="text-[10px] text-slate-400 font-bold">Fish</span>';
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-sky-900/80 text-sky-200 border border-sky-400/50">
                              {row.category?.toLowerCase().includes('fresh') ? 'Fresh Water' : 'Sea Water'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md text-xs font-black capitalize bg-amber-900/80 text-amber-200 border border-amber-400/50">
                              {row.speciesType || 'Fish'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-xs">₹{row.price}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-xs">₹{row.wholesalePricePerKg || row.price}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-sky-400 text-xs">₹{row.exportPricePerKg || row.wholesalePricePerKg || row.price}</td>
                          <td className="py-2.5 px-3 text-slate-300 text-xs truncate max-w-[150px]" title={row.description}>{row.description || '-'}</td>
                          <td className="py-2.5 px-3 text-xs">
                            {row.sizeGrades ? (
                              <div className="flex flex-col gap-0.5 text-[10.5px] font-mono leading-tight whitespace-nowrap">
                                <span className="text-amber-300">S: ₹{row.sizeGrades?.small?.price || row.price} <span className="text-slate-400 text-[9.5px]">(W:{row.sizeGrades?.small?.wholesalePrice || row.wholesalePricePerKg || '-'} E:{row.sizeGrades?.small?.exportPrice || row.exportPricePerKg || '-'})</span></span>
                                <span className="text-cyan-300">M: ₹{row.sizeGrades?.medium?.price || row.price} <span className="text-slate-400 text-[9.5px]">(W:{row.sizeGrades?.medium?.wholesalePrice || row.wholesalePricePerKg || '-'} E:{row.sizeGrades?.medium?.exportPrice || row.exportPricePerKg || '-'})</span></span>
                                <span className="text-emerald-300">B: ₹{row.sizeGrades?.big?.price || row.price} <span className="text-slate-400 text-[9.5px]">(W:{row.sizeGrades?.big?.wholesalePrice || row.wholesalePricePerKg || '-'} E:{row.sizeGrades?.big?.exportPrice || row.exportPricePerKg || '-'})</span></span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">
                            {row.customCuttingChargeEnabled ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold w-fit">
                                  ✓ ON (Base: ₹{row.cuttingCharge || 0})
                                </span>
                                <span className="text-[10px] text-slate-300 font-mono">
                                  S: ₹{row.sizeGrades?.small?.cuttingCharge ?? row.cuttingCharge ?? 0} • M: ₹{row.sizeGrades?.medium?.cuttingCharge ?? row.cuttingCharge ?? 0} • B: ₹{row.sizeGrades?.big?.cuttingCharge ?? row.cuttingCharge ?? 0}
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-[10px] font-medium">
                                OFF (₹0)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-colors border border-border">
            {t("Cancel")}
          </button>
          
          <button
            onClick={handleConfirmImport}
            disabled={validCount === 0 || isImporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            {isImporting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>{t("Importing Menu Items...")}</span>
              </>
            ) : (
              <>
                <span>{t("Confirm & Import")} ({validCount} {t("Items")})</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BulkImportModal;
