# 🐟 YNR FISHES — Complete System Credentials & Access Directory

> **Confidential & Operational Reference**  
> *Generated on: November 9, 2026*  
> *Platform: YNR Fishes Cloud & Enterprise Depot POS Suite (v6.0.119)*  
> *Production DB Cluster: MongoDB Atlas Multi-Tenant Replica Set*

---

## 1. 👥 System User Accounts & Portal Credentials

All user accounts have been authenticated and verified against the live production database (`fishes` / `kdp`).

| Role | Full Name | Username | Email | Password | Phone | Branch / Access Level | Permitted Pages / Portal Route | Account Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Administrator** | YNR Super Administrator | `superadmin` | `superadmin@ynrfishes.com` | `SuperAdmin@2026` | `+91 98493 13889` | **Global Headquarters** (Cross-Branch) | Full Access: `billing`, `active-orders`, `bill-history`, `superadmin`, `branches`, `staff`, `reports`, `telemetry`, `broadcasts`, `settings`, `categories`, `menu` | `Active` ✅ |
| **Admin Head** | Kadapa Admin Head | `admin_kdp` | `admin.kdp@ynrfishes.com` | `Admin@2026` | `+91 98493 13889` | **Kadapa City Depot** (`KDP`) | Full Branch Operations: `dashboard`, `billing`, `active-orders`, `bill-history`, `edited-bills`, `menu`, `inventory`, `day-book`, `khata`, `expenses`, `vehicles`, `analytics`, `crm`, `staff`, `printer`, `operations`, `discount`, `security`, `settings`, `notifications` | `Active` ✅ |
| **Branch Manager** | Kadapa Branch Manager | `manager_kdp` | `manager.kdp@ynrfishes.com` | `Manager@2026` | `+91 98493 13887` | **Kadapa City Depot** (`KDP`) | Operations & Analytics: `dashboard`, `billing`, `active-orders`, `bill-history`, `menu`, `day-book`, `khata`, `expenses`, `analytics`, `operations`, `vehicles` | `Active` ✅ |
| **Billing Cashier** | Kadapa Billing Cashier | `cashier_kdp` | `cashier.kdp@ynrfishes.com` | `Cashier@2026` | `+91 98493 13887` | **Kadapa City Depot** (`KDP`) | POS Counter: `billing`, `active-orders`, `bill-history` (Thermal printing & settlement) | `Active` ✅ |
| **Floor Operator / Worker** | Kadapa Floor Operator | `worker_kdp` | `worker.kdp@ynrfishes.com` | `Worker@2026` | `+91 98493 13887` | **Kadapa City Depot** (`KDP`) | Live Weighing & Floor POS: `billing`, `active-orders`, `menu` | `Active` ✅ |
| **Fleet Delivery Driver** | Venkatesh Naidu | `driver_venkatesh_naidu` | `venkatesh_naidu@driver.local` | `Driver@2026` | `+91 98661 23450` | **Kadapa Fleet** (Reefer Van `AP 04 YZ 6723`) | Driver Logistics Portal: `/dashboard/driver` & `/driver-gps` (`driver-portal`) | `Active` ✅ |
| **Catch Procurement Supplier** | Mangalore Supplier *(Sea King Syndicate)* | `supp_mangalore_supplier` | `mangalore_supplier@supplier.local` | `Supplier@2026` | `+91 84894 84844` | **Procurement Network** (Mangalore Bunder Harbor) | Supplier Passbook & Khata: `/dashboard/supplier` (`supplier-portal`) | `Active` ✅ |

---

## 2. 🔐 System Master PINs & Security Keys

| Security Credential | Value | Scope / Description | Usage Instructions |
| :--- | :--- | :--- | :--- |
| **Owner / Master Security PIN** | `4567` | Branch Settings, Bill Editing/Deletion, Sensitive Config | Prompted when unlocking store settings or resetting bills in Admin Panel |
| **Fallback PIN** | `1234` | Emergency Secondary Access PIN | Used as fallback if custom owner PIN is unset |
| **JWT Secret Key** | `ynr_fishes_super_secret_jwt_key_2026_enterprise` | Backend Authentication & Token Signing | Used in `backend/.env` for session token generation |
| **JWT Token Validity** | `36500d` (100 Years) | Enterprise Persistent Logins | Users stay logged in permanently without expiration |

---

## 3. 🗄️ Database & Cloud Storage Credentials

### A. MongoDB Atlas Replica Set (Production)
| Parameter | Value |
| :--- | :--- |
| **Database Username** | `mstechhived1_db_user` |
| **Database Password** | `bcZdeggKnDHgdpmx` |
| **Standard SRV URI** | `mongodb+srv://mstechhived1_db_user:bcZdeggKnDHgdpmx@cluster0.lyywyv4.mongodb.net/?retryWrites=true&w=majority` |
| **Direct Replica Set URI (Windows / DNS Resilient)** | `mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority` |
| **Primary Global Database** | `fishes` |
| **Kadapa Tenant Database** | `kdp` |

### B. ImageKit Cloud Media CDN
| Parameter | Value |
| :--- | :--- |
| **ImageKit ID** | `uy5estwss` |
| **Public API Key** | `public_mhye3LabtJvJX/zprTucrxNhfiA=` |
| **Private API Key** | `private_KDDbri5shkOhR4zNrYjsw2gJGBY=` |
| **URL Endpoint** | `https://ik.imagekit.io/uy5estwss` |

---

## 4. 📱 Android Release Keystore & App Signing

| Keystore Property | Value | Location / Usage |
| :--- | :--- | :--- |
| **Keystore File** | `keystore.jks` | `frontend/android/keystore.jks` |
| **Store Password** | `ynrfishes2026` | Android APK / AAB signing |
| **Key Alias** | `ynrfishes` | Android release key alias |
| **Key Password** | `ynrfishes2026` | Android key password |

---

## 5. 🌐 Cloud Infrastructure, Web APIs & WhatsApp Gateway

| Service / Channel | Host / URL / Number | Credentials / Notes |
| :--- | :--- | :--- |
| **Production Cloud Backend** | `https://ynr-fishes-backend.onrender.com` | Hosted on Render Cloud |
| **Local Development Backend** | `http://localhost:5000` | Port `5000` |
| **Frontend Web App (Local)** | `http://localhost:5173` | Vite Dev Server |
| **WhatsApp Automated Gateway** | `+91 8328470402` | Connected Bot for automated e-bills & DayBook |
| **GitHub Repository** | `https://github.com/ynrfishwebsite-tech/ynr_fishes` | Releases & automated CI/CD builds |
| **Git Release Author** | `saifuddinawaab786` (`saifuddinawaab@gmail.com`) | Build & Tag Actor |

---

## 6. 🚚 Logistics Fleet Vehicles & Supplier Passbooks

| Entity Name | Type / Harbor | Username / ID | Phone / Contact | Vehicle / Account Details | Default Portal Route |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Venkatesh Naidu** | Delivery Fleet Driver | `driver_venkatesh_naidu` | `9866123450` | Reefer Van: `AP 04 YZ 6723` | `/dashboard/driver` & `/driver-gps` |
| **Ramesh Reddy** | Primary Depot Driver | `ramesh_reddy` | `9849313889` | Pickup Truck: `AP 04 TX 4589` | Fleet Management |
| **Suresh Kumar** | Wholesale Bulk Driver | `suresh_kumar` | `9440123456` | Mini Truck: `AP 04 BB 3821` | Fleet Management |
| **Mangalore Supplier** *(Sea King Syndicate)* | Deep Sea Supplier | `supp_mangalore_supplier` | `8489484844` | Mangalore Bunder Harbor (UPI: `seakingsyndicate@okhdfcbank`) | `/dashboard/supplier` |
| **Prasad Reddy** | Freshwater Dam Supplier | `prasad_reddy` | `9988776655` | Srisailam Dam (UPI: `prasad@upi`) | Supplier Ledger |
| **Nagaraju** | Coastal Bay Supplier | `nagaraju` | `9876501234` | Kakinada Fishing Harbour (UPI: `nagaraju@upi`) | Supplier Ledger |

