
# 🎩 Social Genie — AI-Powered Social Concierge (Phase 1)
*By Social Bevy*

Social Genie is an AI-powered social concierge that helps people get social instantly. Users simply tell Genie what vibe they want — “cute patio,” “R&B brunch,” “grown and sexy lounge,” etc. Genie responds with curated venues, personalized suggestions, conversational guidance, and saved spots.

This repo contains the **Genie-first frontend**, built with Next.js + React 19, integrated with **Xano** as the backend for Genie’s venues, and includes the Phase 1 UI used for live user testing.

-

## 🚀 What Genie Does (Phase 1)

### ✔ Conversational-style input  
Users type into Genie’s “How can I get you social?” prompt. Genie parses the vibe keywords and returns matching venues.

### ✔ Venue search powered by Xano  
- All venue data comes from Xano’s *Genie Brain* table.  
- Genie returns matches based on name, neighborhood, vibe notes, energy, music, and general descriptive text.


### ✔ Saved Spots  
Users can save/unsave venues. All saved venue IDs are stored in:

```
localStorage["genie_saved_venues_v1"]
```

Saved spots appear on Genie’s Home Screen under “Your Saved Spots.”

### ✔ Venue detail pages  
Each venue has a full-screen detail page with:
- Hero image  
- Name, neighborhood, city  
- Vibe line  
- Description  
- Hours  
- Save button  
- Share button  
- 
### ✔ Mobile-first UI  
Genie is optimized for iPhone and mobile experience.

---

## 🧠 Current Genie Architecture

### **Frontend (this repo)**
- Next.js 14  
- React 19  
- Tailwind CSS  
- Client-side rendering  
- LocalStorage for saved venues  
- Next/Image for optimized images  
- Deployed on Vercel  

### **Backend**
**Xano** holds all venue data:
- `id`
- `venue_name`
- `area_neighborhood`
- `city`
- `vibe_notes`
- `crowd`
- `music`
- `energy_level`
- `image_primary_url`
- `image_fallback_url`
- `image_url`
- `best_time_to_go`
- `hours`

### **Analytics**
Basic event tracking:
- Query text  
- Venue clicks  
- Shares  
- Weekly picks  

---

## 📁 Project Structure

```
social-genie/
│
├── app/
│   ├── page.tsx               → Genie Home Screen
│   ├── venue/
│   │   └── [id]/page.tsx      → Venue Detail Screen
│
├── lib/
│   ├── genieClient.ts         → Xano API calls
│   ├── analytics.ts           → Tracking events
│
├── public/                    → Genie images, icons, placeholders
│
├── next.config.ts             → Image domain config
├── tailwind.config.js
├── package.json
└── README.md
```

---

## 🔧 Local Development Setup

### 1. Clone the repo
```bash
git clone https://github.com/socialbevy/social-genie.git
cd social-genie
```

### 2. Install dependencies
```bash
npm install
```

### 3. Add environment variables  
Create `.env.local`:

```
NEXT_PUBLIC_XANO_API_BASE_URL=https://xano.com/.../api
```

### 4. Start dev server
```bash
npm run dev
```

Visit at:  
```
http://localhost:3000
```

---

## 🖼️ Image Handling (Important)

Genie uses this priority order:

```
image_primary_url
> image_fallback_url
> image
> image_url
> /sample-venue-1.jpeg
```

⚠ *Most venues still need valid direct image URLs in Xano.*  
A cleanup task is underway to update the table via Max.

---

## 🧪 Phase 1 Completion Checklist

### ✔ Genie UI  
### ✔ Venue search  
### ✔ Saved spots  
### ✔ Save toggle  
### ✔ Share button  
### ✔ Xano integration  
### ✔ Mobile-first layout  
### ✔ Vercel deployment  
### ✔ Github repo connected  

### ❗ Pending  
- Xano image cleanup  
- Conversational Genie  
- Voice input  
- Outside-city fallback  
- Multi-city rollout  

---

## 🤝 Developer Notes

This Phase 1 repo is built for **fast iteration**, not final production architecture.

Upcoming major changes:
- Conversational Genie interface  
- Server-side search  
- Multi-city support  
- Account system  
- Image CDN  

---

## 📬 Contact

**Alphonso Roundtree**  
Founder & CEO — Social Bevy  
Social Genie Team Lead  

 
