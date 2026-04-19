# Prayer Times & Awrad Tracker - PRD

## Overview
Arabic (RTL) mobile app to remind Muslim users of daily prayer times and personal adhkar/awrad with daily, monthly, and yearly statistics.

## Core Features
1. **Prayer Times (Home)**
   - 5 daily prayers from Aladhan API (Umm al-Qura method)
   - Countdown to next prayer, Hijri + Gregorian date, current city
   - Tap-to-mark prayers as completed
2. **Adhkar & Awrad**
   - Morning adhkar, Evening adhkar, After-prayer adhkar, Sleep adhkar (interactive counters)
   - Tasbih counter with multiple phrases
   - Daily Quran pages tracker with +5/+10/+20 presets
   - Custom user-defined awrad (create / increment / delete)
3. **Statistics**
   - Today KPIs, streak of consecutive active days
   - Week / Month / Year toggle with totals + 14-day bar chart
4. **Settings**
   - Update location (expo-location + reverse geocode)
   - Local prayer-time notifications (expo-notifications, native only)
   - About

## Architecture
- Frontend: Expo SDK 54 + expo-router (flat Tabs layout, 4 tabs, RTL forced)
- Backend: FastAPI + Motor (MongoDB), all routes prefixed `/api`
- Storage: MongoDB `activities` (device_id+date) and `custom_wirds` collections
- External: Aladhan API for prayer times (proxied via backend)
- No authentication — device_id stored in AsyncStorage identifies the user

## Key API Endpoints
- `GET /api/prayer-times?lat&lng&date`
- `GET /api/day?device_id&date`
- `POST /api/prayers/toggle`, `/api/adhkar/toggle`
- `POST /api/tasbih/add`, `/api/tasbih/reset`
- `POST /api/quran/set`
- `POST /api/wirds` (create), `GET /api/wirds`, `DELETE /api/wirds/{id}?device_id`, `POST /api/wirds/log`
- `GET /api/stats/summary?device_id`, `GET /api/stats/range?device_id&start&end`

## Business Enhancement (future growth)
- **Shareable streak cards** — users export a branded image of their "X-day streak" to social media, driving organic install loops (highest leverage for a devotional habit app).
