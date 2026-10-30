import React, { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, FileText, ArrowRight, RefreshCw } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { useLanguage } from '../../../context/LanguageContext';

const SAMPLE_10_ITEMS = [
  { name: 'Rohu (రోహు)', scientificName: 'Labeo rohita', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 100, price: 150, variants: 'Live:150, Cleaned/Cut:200', openingStock: 250, boxPackingKg: 60, description: 'Fresh river Rohu fish, sweet water catch', isAvailable: 'TRUE', image: '/bocha.png' },
  { name: 'Katla (బొచ్చె / కాట్లా)', scientificName: 'Gibelion catla', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 180, price: 220, variants: 'Live:220, Headless:250', openingStock: 200, boxPackingKg: 60, description: 'Live sweet water Katla, premium weight', isAvailable: 'TRUE', image: '/catla.png' },
  { name: 'Red Prawns / రొయ్యలు', scientificName: 'Penaeus monodon', category: 'Prawns & Shrimps', sellingUnit: 'Kg', purchasePrice: 280, price: 350, variants: 'Tiger:600, Red Prawn:300, Vannamei:300, River:400, Sea:500', openingStock: 150, boxPackingKg: 60, description: 'Sea & river fresh prawns, counts 20/30/40', isAvailable: 'TRUE', image: '/images/prawns.jpg' },
  { name: 'Basa Fish / పంగస్', scientificName: 'Pangasius bocourti', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 120, price: 150, variants: 'Whole:150, Fillet:400', openingStock: 180, boxPackingKg: 60, description: 'Boneless white meat Pangas/Basa fish', isAvailable: 'TRUE', image: '/pangas.png' },
  { name: 'White Pomfret (తెల్ల చందువా)', scientificName: 'Pampus argenteus', category: 'Sea Water', sellingUnit: 'Piece', purchasePrice: 1300, price: 1500, variants: 'Large (1kg):1650, Medium (500g):1500', openingStock: 80, boxPackingKg: 30, description: 'Premium grade white pomfret, Vizag harbor direct', isAvailable: 'TRUE', image: '/pumenu.png' },
  { name: 'Vanjaram / King Fish (వంజరం)', scientificName: 'Scomberomorus commerson', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 600, price: 850, variants: 'Whole:850, King Slices:1200', openingStock: 120, boxPackingKg: 60, description: 'King mackerel large catch, ideal for fry & curry', isAvailable: 'TRUE', image: '/kontimuka.png' },
  { name: 'Tilapia / Pilot (తిలాపియా)', scientificName: 'Oreochromis niloticus', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 80, price: 100, variants: 'Small:100, Medium:110, 1pc/kg:120', openingStock: 300, boxPackingKg: 60, description: 'Firm fresh water Tilapia/Jilebi fish', isAvailable: 'TRUE', image: '/jalebi.png' },
  { name: 'Korramenu / Murrel Live (కొర్రమీను)', scientificName: 'Channa striata', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 320, price: 400, variants: 'Live:400, Cleaned:450', openingStock: 140, boxPackingKg: 60, description: 'High-protein predatory live Murrel fish', isAvailable: 'TRUE', image: '/korameenu.png' },
  { name: 'Common Fish (కామన్ ఫిష్)', scientificName: 'Cyprinus carpio', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 380, price: 500, variants: 'Standard:500', openingStock: 100, boxPackingKg: 60, description: 'Fresh sweet water grass/common carp', isAvailable: 'TRUE', image: '/gaddi.png' },
  { name: 'Mattu / మట్టు', scientificName: 'Siluriformes', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 150, price: 200, variants: 'Regular:200', openingStock: 110, boxPackingKg: 60, description: 'Fresh water Mattu fish', isAvailable: 'TRUE', image: '/mosu.png' },
  { name: 'Karimeen / కరిమీన్', scientificName: 'Etroplus suratensis', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 250, price: 300, variants: 'Medium:300, Large:400', openingStock: 90, boxPackingKg: 40, description: 'Pearl spot fish / Chuka Jilebi delicacy', isAvailable: 'TRUE', image: '/chuka jilebi.png' },
  { name: 'Apollo Meat / అపోలో ఫిష్', scientificName: 'Fish Boneless Fillet', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 240, price: 300, variants: 'Cut Pieces:300, Finger Cut:400', openingStock: 120, boxPackingKg: 50, description: 'Boneless cube-cut fish meat for Apollo fish fry', isAvailable: 'TRUE', image: '/cut jella.png' },
  { name: 'Tuna / సూర (చూర)', scientificName: 'Thunnini', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 300, price: 400, variants: 'Steaks:400, Whole:350', openingStock: 160, boxPackingKg: 60, description: 'Ocean yellowfin / skipjack tuna', isAvailable: 'TRUE', image: '/dhoma.png' },
  { name: 'Aila / కనగర్తలు', scientificName: 'Rastrelliger kanagurta', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 220, price: 300, variants: 'Fresh Catch:300, Large:350', openingStock: 220, boxPackingKg: 60, description: 'Indian mackerel rich in Omega-3', isAvailable: 'TRUE', image: '/ulinka.png' },
  { name: 'Sheelavathi / ఓషా ఫిష్', scientificName: 'Labeo rohita hybrid', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 240, price: 300, variants: 'Whole:300, Cleaned:400', openingStock: 170, boxPackingKg: 60, description: 'Tender sweet water Sheelavathi / Osha fish', isAvailable: 'TRUE', image: '/gaddi.png' },
  { name: 'Nethallu / Nethili (నెత్తళ్లు)', scientificName: 'Anchoviella commersonii', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 260, price: 350, variants: 'Small:350, White Large:450', openingStock: 130, boxPackingKg: 40, description: 'Fresh small coastal white anchovies', isAvailable: 'TRUE', image: '/jella.png' },
  { name: 'Black Pomfret (నల్ల చందువా)', scientificName: 'Parastromateus niger', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 650, price: 800, variants: 'Standard:800', openingStock: 100, boxPackingKg: 50, description: 'Deep sea black pomfret Halva', isAvailable: 'TRUE', image: '/pumenu.png' },
  { name: 'Sea Crabs / పీతలు', scientificName: 'Portunus pelagicus', category: 'Crabs & Shellfish', sellingUnit: 'Kg', purchasePrice: 280, price: 350, variants: 'Medium:350, Jumbo Sea:500', openingStock: 110, boxPackingKg: 40, description: 'Live blue swimming sea crabs', isAvailable: 'TRUE', image: '/images/crabs.jpg' },
  { name: 'Mirayal / మిరయల్', scientificName: 'Cirrhinus mrigala', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 110, price: 150, variants: 'Standard:150', openingStock: 190, boxPackingKg: 60, description: 'Fresh sweet water Mrigal carp', isAvailable: 'TRUE', image: '/bocha.png' },
  { name: 'Bangaru Theega / Golden Fish (బంగారుతీగ)', scientificName: 'Carassius auratus', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 100, price: 150, variants: 'Standard:150', openingStock: 210, boxPackingKg: 60, description: 'Fresh water Bangaru Theega fish', isAvailable: 'TRUE', image: '/bangaru teega.png' },
  { name: 'Koli / కోలి చేప', scientificName: 'Otolithes ruber', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 70, price: 100, variants: 'Standard:100', openingStock: 160, boxPackingKg: 60, description: 'Coastal small Croaker Koli fish', isAvailable: 'TRUE', image: '/kontimuka.png' },
  { name: 'Pothi Gini / చిన్న చేపలు', scientificName: 'Puntius sophore', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 180, price: 250, variants: 'Fresh Catch:250, Cleaned:300', openingStock: 130, boxPackingKg: 40, description: 'Local sweet water small fish mix', isAvailable: 'TRUE', image: '/chuka jilebi.png' },
  { name: 'Rani / గులివిందలు', scientificName: 'Nemipterus japonicus', category: 'Sea Water', sellingUnit: 'Kg', purchasePrice: 220, price: 300, variants: 'Pink Perch:300', openingStock: 150, boxPackingKg: 50, description: 'Japanese threadfin bream / Pink Perch Rani fish', isAvailable: 'TRUE', image: '/ulinka.png' },
  { name: 'Wallago / వాలగ (ఆల)', scientificName: 'Wallago attu', category: 'Fresh Water', sellingUnit: 'Kg', purchasePrice: 150, price: 200, variants: 'Whole:200, Large Slices:350', openingStock: 140, boxPackingKg: 60, description: 'Fresh water river shark Wallago / Valuga fish', isAvailable: 'TRUE', image: '/valuga.png' }
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
    { header: 'Scientific Name', key: 'scientificName', minWidth: 22 },
    { header: 'Category', key: 'category', minWidth: 18 },
    { header: 'Selling Unit', key: 'sellingUnit', minWidth: 14 },
    { header: 'Purchase Price (₹/Kg)', key: 'purchasePrice', minWidth: 22 },
    { header: 'Selling Price (₹/Kg)', key: 'price', minWidth: 20 },
    { header: 'Variants', key: 'variants', minWidth: 32 },
    { header: 'Opening Stock (Kg)', key: 'openingStock', minWidth: 20 },
    { header: 'Box Packing (Kg)', key: 'boxPackingKg', minWidth: 18 },
    { header: 'Description', key: 'description', minWidth: 40 },
    { header: 'Is Available', key: 'isAvailable', minWidth: 15 },
    { header: 'Image URL', key: 'image', minWidth: 50 },
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
      Category: i.category,
      'Selling Unit': i.sellingUnit || 'Kg',
      'Purchase Price (₹/Kg)': i.purchasePrice || 0,
      'Selling Price (₹/Kg)': i.price,
      Variants: i.variants || '',
      'Opening Stock (Kg)': i.openingStock || 0,
      'Box Packing (Kg)': i.boxPackingKg || 60,
      Description: i.description,
      'Is Available': i.isAvailable,
      'Image URL': i.image
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
        const category = getVal('Category', 'Category Name');
        const sellingUnit = getVal('Selling Unit', 'SellingUnit', 'Unit') || 'Kg';
        const purchasePriceRaw = getVal('Purchase Price (₹/Kg)', 'Purchase Price', 'PurchasePrice', 'Cost Price', 'Cost');
        const priceRaw = getVal('Selling Price (₹/Kg)', 'Selling Price', 'Price', 'Item Price', 'Cost', 'Rate');
        const variantsRaw = getVal('Variants', 'Variant', 'Varieties', 'Variety');
        const openingStockRaw = getVal('Opening Stock (Kg)', 'Opening Stock', 'OpeningStock', 'Stock');
        const boxPackingKgRaw = getVal('Box Packing (Kg)', 'Box Packing', 'BoxPackingKg', 'BoxPacking');
        const description = getVal('Description', 'Item Description');
        const isAvailableRaw = getVal('Is Available', 'IsAvailable', 'Available');
        const taxRateRaw = getVal('Tax Rate', 'TaxRate', 'Tax');
        const image = getVal('Image URL', 'ImageURL', 'Image', 'Photo');

        // Parse Variants into array of { name, price } (supports "Tiger:600, Red Prawn:300" or "Tiger:600|Red Prawn:300")
        let parsedVariants = [];
        if (variantsRaw && typeof variantsRaw === 'string') {
          const delimiter = variantsRaw.includes('|') ? '|' : ',';
          parsedVariants = variantsRaw.split(delimiter)
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
              const [vName, vPrice] = part.split(':').map(s => s.trim());
              return {
                name: vName || '',
                price: parseFloat(vPrice) || 0
              };
            })
            .filter(v => v.name);
        }

        // Sweet shop specific fields
        const pricePerKgRaw = getVal('Price Per Kg', 'PricePerKg', 'Price/Kg');
        const piecesPerKgRaw = getVal('Pieces Per Kg', 'PiecesPerKg', 'Pieces/Kg');
        const sellByWeightRaw = getVal('Sell By Weight', 'SellByWeight');
        const sellByPieceRaw = getVal('Sell By Piece', 'SellByPiece');

        const price = parseFloat(priceRaw) || 0;
        const purchasePrice = parseFloat(purchasePriceRaw) || 0;
        const openingStock = parseFloat(openingStockRaw) || 0;
        const boxPackingKg = parseFloat(boxPackingKgRaw) || 60;
        const taxRate = parseFloat(taxRateRaw) || 0;
        const pricePerKg = parseFloat(pricePerKgRaw) || 0;
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
          boxPackingKg,
          price: isSweetsMode ? pricePerKg : price,
          variants: parsedVariants,
          variantsString: variantsRaw || '',
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
                  {importMode === 'sweets' ? '🍬 Sweet Shop Fields & Format' : t("Fields & Excel Format Requirements")}
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

            {/* Quick Field Info Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs pt-1">
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Fish Name *</span>
                <span className="text-[11px] text-text-muted">e.g. Silver Pomfret, Tiger Prawns</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Scientific Name</span>
                <span className="text-[11px] text-text-muted">e.g. Pampus argenteus</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Category *</span>
                <span className="text-[11px] text-text-muted">Sea Water, Fresh Water, Prawns</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Selling Unit *</span>
                <span className="text-[11px] text-text-muted">Kg, Box, Piece (Default: Kg)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Purchase Price</span>
                <span className="text-[11px] text-text-muted">Wholesale rate in ₹/Kg (e.g. 650)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Selling Price *</span>
                <span className="text-[11px] text-text-muted">Selling rate in ₹/Kg (e.g. 780)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-semibold text-text-main block">Opening Stock</span>
                <span className="text-[11px] text-text-muted">Current inventory in Kg (e.g. 150)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-semibold text-text-main block">Box Packing</span>
                <span className="text-[11px] text-text-muted">Kg per standard crate (e.g. 60)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-bold text-sky-400 block">Variants</span>
                <span className="text-[11px] text-text-muted">Tiger:600, Red Prawn:300</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-semibold text-text-main block">Description</span>
                <span className="text-[11px] text-text-muted">Harbour origin & quality notes</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-semibold text-text-main block">Is Available</span>
                <span className="text-[11px] text-text-muted">TRUE / FALSE (Default: TRUE)</span>
              </div>
              <div className="p-2 bg-surface rounded-lg border border-border/50">
                <span className="font-semibold text-text-main block">Image URL</span>
                <span className="text-[11px] text-text-muted">Direct Image Link</span>
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
                    👉 Swipe left / right to view all columns (Price, Stock, Image)
                  </span>
                </div>
                <div className="border border-[#E8DCCB] rounded-xl overflow-hidden shadow-xs max-h-[360px] overflow-y-auto overflow-x-auto overscroll-contain bg-white">
                  <table className="min-w-[980px] w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F7EFE2] text-slate-700 font-bold text-xs uppercase tracking-wider sticky top-0 z-20 border-b border-[#E8DCCB] shadow-xs">
                        <th className="py-2.5 px-3 w-10 text-center sticky left-0 z-30 bg-[#F7EFE2] text-slate-700 shadow-[1px_0_0_#eedecb]">#</th>
                        <th className="py-2.5 px-3 w-24 text-center">{t("Status")}</th>
                        <th className="py-2.5 px-3 min-w-[150px]">{t("Fish Name")}</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Scientific Name</th>
                        <th className="py-2.5 px-3 min-w-[120px]">{t("Category")}</th>
                        <th className="py-2.5 px-3 text-center w-16">Unit</th>
                        <th className="py-2.5 px-3 text-right w-24">Purchase (₹)</th>
                        <th className="py-2.5 px-3 text-right w-24">Selling (₹)</th>
                        <th className="py-2.5 px-3 min-w-[160px]">Variants</th>
                        <th className="py-2.5 px-3 text-center w-20">Stock (Kg)</th>
                        <th className="py-2.5 px-3 text-center w-20">Box (Kg)</th>
                        <th className="py-2.5 px-3 text-center w-20">Image</th>
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold rounded-full text-[11px]">
                                <CheckCircle size={11} /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold rounded-full text-[11px]" title={`Missing: ${row.missingFields.join(', ')}`}>
                                <AlertCircle size={11} /> Missing
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white text-xs">{row.name || <span className="text-amber-400 italic">Missing</span>}</td>
                          <td className="py-2.5 px-3 text-sky-200/80 italic text-xs font-medium">{row.scientificName || '-'}</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-semibold text-xs">{row.category || <span className="text-amber-400 italic">Missing</span>}</td>
                          <td className="py-2.5 px-3 text-center text-slate-200 font-bold text-xs">{row.sellingUnit || 'Kg'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-200 font-semibold text-xs">₹{row.purchasePrice || 0}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-extrabold text-[#4ee1a0] text-xs">₹{row.price}</td>
                          <td className="py-2.5 px-3 text-xs">
                            {row.variants && row.variants.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[220px]">
                                {row.variants.map((v, vi) => (
                                  <span key={vi} className="px-2 py-0.5 bg-sky-900/90 text-cyan-200 border border-cyan-400/50 rounded font-semibold text-[11px] whitespace-nowrap shadow-xs">
                                    {v.name}: ₹{v.price}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-white text-xs">{row.openingStock || 0}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-300 text-xs">{row.boxPackingKg || 60}</td>
                          <td className="py-2 px-3 text-center">
                            {row.image ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-sky-400/40 mx-auto bg-slate-900/80 shadow-md flex items-center justify-center group relative">
                                <img
                                  src={row.image}
                                  alt={row.name}
                                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement.innerHTML = '<span class="text-xs text-slate-400">🐟</span>';
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-500 text-xs">-</span>
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
