# আমার গান — Bengali Music Player

সহজ HTML + CSS + JavaScript দিয়ে তৈরি মিউজিক প্লেয়ার ওয়েবসাইট। কোনো build step নেই।

## ফোল্ডার কাঠামো
```
bengali-music-player/
├── package.json
├── vercel.json
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── songs.js          <- গানের ফাইলের নামের তালিকা
    └── audio/            <- আপনার আসল .ogg ফাইল (৯টি)
```

## কম্পিউটারে চালানো
1. Node.js ইন্সটল করুন (https://nodejs.org)।
2. প্রজেক্ট ফোল্ডারে Terminal/CMD খুলে লিখুন:
   ```
   npm install
   npm run dev
   ```
3. ব্রাউজারে খুলুন: http://localhost:3000

(Node ছাড়া চাইলে: `python3 -m http.server 3000 --directory public`)

## Vercel-এ ডিপ্লয়
**পদ্ধতি ১ (GitHub):** প্রজেক্ট GitHub-এ push করুন → vercel.com → Add New → Project → repository বেছে নিন → Deploy।
(Framework: Other; Build Command ফাঁকা; Output Directory: `public` — vercel.json এ আগেই দেওয়া আছে।)

**পদ্ধতি ২ (CLI):**
```
npm i -g vercel
vercel
vercel --prod
```

## নতুন গান যোগ করা
১. `.ogg` ফাইল `public/audio/` এ রাখুন।  ২. `public/songs.js` এ ফাইলের নাম যোগ করুন।
