const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const DB_URL = 'mongodb+srv://Mtox:Mert2012.@sumy.y8tmzld.mongodb.net/?appName=Sumy';
mongoose.connect(DB_URL)
    .then(() => console.log('Bulut veritabanına bağlandık!'))
    .catch(err => console.error('Bağlantı hatası:', err));

const User = mongoose.model('User', new mongoose.Schema({
    nickname: String, realname: String, password: String, profilePic: String
}));
const Group = mongoose.model('Group', new mongoose.Schema({
    id: String, name: String, password: String, members: [String], messages: Array
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'images')); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'welcome.html'));
});

app.get('/welcome', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'welcome.html'));
});

app.get('/haveAcc', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'haveAcc.html'));
});

app.get('/createAcc', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login', 'createAcc.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/kayit', upload.single('profilePic'), async (req, res) => {
    const { nickname, realname, password } = req.body;
    const varMi = await User.findOne({ nickname });
    if (varMi) return res.json({ basarili: false, hata: 'Bu takma ad zaten alınmış' });
    const profilePic = req.file ? '/uploads/' + req.file.filename : null;
    await new User({ nickname, realname, password, profilePic }).save();
    res.json({ basarili: true });
});

app.post('/giris', async (req, res) => {
    const { nickname, password } = req.body;
    const kullanici = await User.findOne({ nickname, password });
    if (!kullanici) return res.json({ basarili: false, hata: 'Kullanıcı adı veya şifre yanlış' });
    req.session.kullanici = kullanici;
    res.json({ basarili: true });
});

app.post('/create-group', async (req, res) => {
    const { name, password } = req.body;
    const id = '#' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const group = await new Group({ id, name, password: password || null, members: [], messages: [] }).save();
    res.json({ basarili: true, group });
});

app.post('/join-group', async (req, res) => {
    const { groupId, password, nickname } = req.body;
    const group = await Group.findOne({ id: groupId.toUpperCase() });
    if (!group) return res.json({ basarili: false, hata: "Grup bulunamadı" });
    if (group.password && group.password !== password) return res.json({ basarili: false, hata: 'Şifre yanlış' });
    if (!group.members.includes(nickname)) {
        await Group.updateOne({ id: group.id }, { $push: { members: nickname } });
    }
    res.json({ basarili: true, group });
});

app.post('/send-message', async (req, res) => {
    try {
        const { groupId, message } = req.body;
        if (!req.session.kullanici) return res.status(401).send("Giriş gerekli");
        const msg = { 
            nickname: req.session.kullanici.nickname, 
            message, 
            time: new Date().toISOString() 
        };
        const result = await Group.updateOne(
            { id: groupId }, 
            { $push: { messages: msg } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ basarili: false, hata: "Grup bulunamadı" });
        }
        io.to(groupId).emit('yeni-mesaj', msg);
        res.json({ basarili: true });
    } catch (error) {
        console.error("MESAJ GÖNDERME HATASI:", error);
        res.status(500).json({ basarili: false, hata: "Sunucu hatası" });
    }
});

app.get('/mesajlar/:groupId', async (req, res) => {
    const group = await Group.findOne({ id: decodeURIComponent(req.params.groupId) });
    res.json(group ? group.messages : []);
});

app.get('/groups', async (req, res) => {
    const groups = await Group.find();
    res.json(groups);
});

app.get('/me', (req, res) => {
    res.json(req.session.kullanici ? { basarili: true, kullanici: req.session.kullanici } : { basarili: false });
});

io.on('connection', (socket) => {
    socket.on('join-group', (groupId) => socket.join(groupId));
    socket.on('mesaj', (data) => io.emit('mesaj', { metin: data.metin, id: socket.id }));
});

server.listen(PORT, () => console.log('Sunucu ' + PORT + ' portunda çalışıyor...'));