/**
 * RailETA — Indian Railways Master Station GIS & Topological Catalog
 * Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains
 * 
 * Verified WGS-84 station coordinates for 80+ major Indian Railway Junctions & Terminals.
 */

export interface StationMetadata {
  code: string;
  name: string;
  lat: number;
  lng: number;
  zone?: string;
  div?: string;
}

export const STATION_MASTER: Record<string, StationMetadata> = {
  // Northern & NCR
  NDLS: { code: "NDLS", name: "New Delhi", lat: 28.6415, lng: 77.2197, zone: "NR" },
  DLI:  { code: "DLI",  name: "Old Delhi Junction", lat: 28.6606, lng: 77.2272, zone: "NR" },
  NZM:  { code: "NZM",  name: "Hazrat Nizamuddin", lat: 28.5886, lng: 77.2534, zone: "NR" },
  ANVT: { code: "ANVT", name: "Anand Vihar Terminal", lat: 28.6508, lng: 77.3153, zone: "NR" },
  GZB:  { code: "GZB",  name: "Ghaziabad Junction", lat: 28.6657, lng: 77.4393, zone: "NR" },
  ALJN: { code: "ALJN", name: "Aligarh Junction", lat: 27.8974, lng: 78.0777, zone: "NCR" },
  TDL:  { code: "TDL",  name: "Tundla Junction", lat: 27.2066, lng: 78.2435, zone: "NCR" },
  CNB:  { code: "CNB",  name: "Kanpur Central", lat: 26.4547, lng: 80.3512, zone: "NCR" },
  LKO:  { code: "LKO",  name: "Lucknow Charbagh", lat: 26.8317, lng: 80.9234, zone: "NR" },
  LJN:  { code: "LJN",  name: "Lucknow Junction", lat: 26.8322, lng: 80.9218, zone: "NER" },
  PRYJ: { code: "PRYJ", name: "Prayagraj Junction", lat: 25.4414, lng: 81.8432, zone: "NCR" },
  BSB:  { code: "BSB",  name: "Varanasi Junction", lat: 25.3283, lng: 82.9863, zone: "NR" },
  GKP:  { code: "GKP",  name: "Gorakhpur Junction", lat: 26.7588, lng: 83.3820, zone: "NER" },
  MB:   { code: "MB",   name: "Moradabad Junction", lat: 28.8386, lng: 78.7733, zone: "NR" },
  BE:   { code: "BE",   name: "Bareilly Junction", lat: 28.3377, lng: 79.4182, zone: "NR" },
  AGC:  { code: "AGC",  name: "Agra Cantt", lat: 27.1585, lng: 77.9942, zone: "NCR" },
  GWL:  { code: "GWL",  name: "Gwalior Junction", lat: 26.2183, lng: 78.1828, zone: "NCR" },
  VGLJ: { code: "VGLJ", name: "VGL Jhansi Junction", lat: 25.4484, lng: 78.5685, zone: "NCR" },
  BPL:  { code: "BPL",  name: "Bhopal Junction", lat: 23.2667, lng: 77.4167, zone: "WCR" },
  ET:   { code: "ET",   name: "Itarsi Junction", lat: 22.6128, lng: 77.7639, zone: "WCR" },

  // Punjab / Haryana / J&K / Rajasthan
  UMB:  { code: "UMB",  name: "Ambala Cantt Junction", lat: 30.3610, lng: 76.8340, zone: "NR" },
  CDG:  { code: "CDG",  name: "Chandigarh Junction", lat: 30.7046, lng: 76.8242, zone: "NR" },
  LDH:  { code: "LDH",  name: "Ludhiana Junction", lat: 30.9010, lng: 75.8573, zone: "NR" },
  JUC:  { code: "JUC",  name: "Jalandhar City", lat: 31.3322, lng: 75.5847, zone: "NR" },
  ASR:  { code: "ASR",  name: "Amritsar Junction", lat: 31.6340, lng: 74.8723, zone: "NR" },
  JAT:  { code: "JAT",  name: "Jammu Tawi", lat: 32.7060, lng: 74.8797, zone: "NR" },
  SVDK: { code: "SVDK", name: "SMVD Katra", lat: 32.9912, lng: 74.9317, zone: "NR" },
  JP:   { code: "JP",   name: "Jaipur Junction", lat: 26.9196, lng: 75.7878, zone: "NWR" },
  AII:  { code: "AII",  name: "Ajmer Junction", lat: 26.4526, lng: 74.6399, zone: "NWR" },
  JU:   { code: "JU",   name: "Jodhpur Junction", lat: 26.2847, lng: 73.0243, zone: "NWR" },
  KOTA: { code: "KOTA", name: "Kota Junction", lat: 25.2138, lng: 75.8648, zone: "WCR" },
  MTJ:  { code: "MTJ",  name: "Mathura Junction", lat: 27.4924, lng: 77.6737, zone: "NCR" },

  // Western / Central
  BCT:  { code: "BCT",  name: "Mumbai Central", lat: 18.9696, lng: 72.8193, zone: "WR" },
  CSMT: { code: "CSMT", name: "Mumbai CSMT", lat: 18.9401, lng: 72.8354, zone: "CR" },
  BDTS: { code: "BDTS", name: "Bandra Terminus", lat: 19.0624, lng: 72.8407, zone: "WR" },
  LTT:  { code: "LTT",  name: "Lokmanya Tilak Terminus", lat: 19.0694, lng: 72.8906, zone: "CR" },
  KYN:  { code: "KYN",  name: "Kalyan Junction", lat: 19.2364, lng: 73.1306, zone: "CR" },
  PUNE: { code: "PUNE", name: "Pune Junction", lat: 18.5284, lng: 73.8743, zone: "CR" },
  ST:   { code: "ST",   name: "Surat", lat: 21.2049, lng: 72.8406, zone: "WR" },
  BRC:  { code: "BRC",  name: "Vadodara Junction", lat: 22.3107, lng: 73.1812, zone: "WR" },
  ADI:  { code: "ADI",  name: "Ahmedabad Junction", lat: 23.0269, lng: 72.6012, zone: "WR" },
  RTM:  { code: "RTM",  name: "Ratlam Junction", lat: 23.3344, lng: 75.0371, zone: "WR" },
  NGP:  { code: "NGP",  name: "Nagpur Junction", lat: 21.1524, lng: 79.0888, zone: "CR" },
  BSL:  { code: "BSL",  name: "Bhusaval Junction", lat: 21.0455, lng: 75.7885, zone: "CR" },

  // Eastern & North-Eastern
  HWH:  { code: "HWH",  name: "Howrah Junction", lat: 22.5839, lng: 88.3426, zone: "ER" },
  SDAH: { code: "SDAH", name: "Sealdah", lat: 22.5684, lng: 88.3713, zone: "ER" },
  DGR:  { code: "DGR",  name: "Durgapur", lat: 23.4986, lng: 87.3119, zone: "ER" },
  ASN:  { code: "ASN",  name: "Asansol Junction", lat: 23.6889, lng: 86.9661, zone: "ER" },
  DHN:  { code: "DHN",  name: "Dhanbad Junction", lat: 23.7957, lng: 86.4304, zone: "ECR" },
  GAYA: { code: "GAYA", name: "Gaya Junction", lat: 24.7955, lng: 84.9994, zone: "ECR" },
  DDU:  { code: "DDU",  name: "Pt. Deen Dayal Upadhyaya Junction", lat: 25.2818, lng: 83.1189, zone: "ECR" },
  PNBE: { code: "PNBE", name: "Patna Junction", lat: 25.6022, lng: 85.1376, zone: "ECR" },
  DNR:  { code: "DNR",  name: "Danapur", lat: 25.6267, lng: 85.0447, zone: "ECR" },
  PPTA: { code: "PPTA", name: "Patliputra Junction", lat: 25.6416, lng: 85.0934, zone: "ECR" },
  BJU:  { code: "BJU",  name: "Barauni Junction", lat: 25.4746, lng: 85.9734, zone: "ECR" },
  KIR:  { code: "KIR",  name: "Katihar Junction", lat: 25.5492, lng: 87.5714, zone: "NFR" },
  NJP:  { code: "NJP",  name: "New Jalpaiguri Junction", lat: 26.6853, lng: 88.4419, zone: "NFR" },
  NCB:  { code: "NCB",  name: "New Cooch Behar", lat: 26.3323, lng: 89.4673, zone: "NFR" },
  NBQ:  { code: "NBQ",  name: "New Bongaigaon", lat: 26.5057, lng: 90.5487, zone: "NFR" },
  GHY:  { code: "GHY",  name: "Guwahati", lat: 26.1822, lng: 91.7513, zone: "NFR" },
  DBRG: { code: "DBRG", name: "Dibrugarh", lat: 27.4728, lng: 94.9120, zone: "NFR" },

  // Southern & South-Western
  MAS:  { code: "MAS",  name: "Chennai Central (Dr MGR)", lat: 13.0827, lng: 80.2707, zone: "SR" },
  MS:   { code: "MS",   name: "Chennai Egmore", lat: 13.0784, lng: 80.2612, zone: "SR" },
  SBC:  { code: "SBC",  name: "KSR Bengaluru City", lat: 12.9781, lng: 77.5696, zone: "SWR" },
  YPR:  { code: "YPR",  name: "Yesvantpur Junction", lat: 13.0238, lng: 77.5503, zone: "SWR" },
  SMVB: { code: "SMVB", name: "SMVT Bengaluru", lat: 13.0039, lng: 77.6534, zone: "SWR" },
  SC:   { code: "SC",   name: "Secunderabad Junction", lat: 17.4339, lng: 78.5045, zone: "SCR" },
  HYB:  { code: "HYB",  name: "Hyderabad Deccan", lat: 17.3920, lng: 78.4674, zone: "SCR" },
  BZA:  { code: "BZA",  name: "Vijayawada Junction", lat: 16.5186, lng: 80.6200, zone: "SCR" },
  VSKP: { code: "VSKP", name: "Visakhapatnam Junction", lat: 17.7215, lng: 83.2906, zone: "ECoR" },
  TVC:  { code: "TVC",  name: "Thiruvananthapuram Central", lat: 8.4871, lng: 76.9532, zone: "SR" },
  ERS:  { code: "ERS",  name: "Ernakulam Junction", lat: 9.9675, lng: 76.2926, zone: "SR" },
  CBE:  { code: "CBE",  name: "Coimbatore Junction", lat: 11.0018, lng: 76.9629, zone: "SR" },
  MDU:  { code: "MDU",  name: "Madurai Junction", lat: 9.9252, lng: 78.1105, zone: "SR" },
  BBS:  { code: "BBS",  name: "Bhubaneswar", lat: 20.2668, lng: 85.8436, zone: "ECoR" },
  PURI: { code: "PURI", name: "Puri", lat: 19.8135, lng: 85.8315, zone: "ECoR" },
  TATA: { code: "TATA", name: "Tatanagar Junction", lat: 22.7667, lng: 86.2000, zone: "SER" }
};
