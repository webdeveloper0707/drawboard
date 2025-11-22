# Network IP Setup Guide

## Network Pe Access Karne Ke Liye

### Step 1: Apna IP Address Find Karein

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" - example: `192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
```
Ya
```bash
ip addr show
```

### Step 2: Server Start Karein

```bash
node server.js
```

Server ab **0.0.0.0** par bind hoga, jo sab network interfaces ko allow karta hai.

### Step 3: Network Pe Access Karein

1. **Same Network Par:**
   - Desktop: `http://192.168.1.100:3001/collaborative`
   - Mobile: `http://192.168.1.100:3001/collaborative`
   - Dusre Computer: `http://192.168.1.100:3001/collaborative`

2. **Auto-Detection:**
   - Client automatically current hostname use karega
   - Agar aap `http://192.168.1.100:3001` se access karte hain, to Socket.io bhi same IP use karega

### Step 4: Firewall Check Karein

**Windows:**
1. Windows Defender Firewall kholo
2. "Allow an app through firewall" select karo
3. Node.js ko allow karo (port 3001)

**Mac:**
```bash
# System Preferences > Security & Privacy > Firewall
```

**Linux:**
```bash
sudo ufw allow 3001
```

### Environment Variables (Optional)

Agar aap specific IP/port use karna chahte hain:

**Server:**
```bash
HOSTNAME=0.0.0.0 PORT=3001 node server.js
```

**Client (.env.local):**
```env
NEXT_PUBLIC_SOCKET_URL=http://192.168.1.100:3001
NEXT_PUBLIC_SOCKET_PORT=3001
```

### Troubleshooting

**Connection Failed?**
1. Check karein server running hai: `node server.js`
2. Check karein firewall port 3001 allow karta hai
3. Check karein dono devices same network par hain
4. Browser console me error check karein

**CORS Error?**
- Server ab sab origins allow karta hai (dev mode me)
- Production me environment variable set karein

**Socket.io Connect Nahi Ho Raha?**
- Check karein network IP sahi hai
- Check karein port 3001 accessible hai
- Browser console me connection logs check karein

### Quick Test

1. Server start karein: `node server.js`
2. Desktop browser me: `http://localhost:3001/collaborative`
3. Mobile browser me: `http://<your-ip>:3001/collaborative`
4. Dono me same room ID use karein
5. Draw karke dekhein - real-time sync hona chahiye!

### Production Deployment

Production me:
1. Environment variable set karein: `NEXT_PUBLIC_SOCKET_URL`
2. CORS properly configure karein (specific domains)
3. HTTPS use karein for security
4. Proper authentication add karein

