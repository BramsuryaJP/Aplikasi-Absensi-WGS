
// memanggil module express
const express = require('express')
// memanggil db.js
const pool = require('./config/db.config.js')
// memanggil module express-ejs-layouts
const expressLayouts = require('express-ejs-layouts')
// memanggil module express-validator
const { body, validationResult, check, cookie } = require('express-validator');
// memanggil module bcrypt
const bcrypt = require('bcrypt');
// memanggil module connect flash
const flash = require('connect-flash');
// memanggil module fs
const fs = require('fs')
// memanggil module express-session
const session = require("express-session");
//
const cookieParser = require('cookie-parser')
// memanggil module morgan
const morgan = require('morgan')
// memanggil module moment
const moment = require('moment')
// memanggil module multer
const multer = require('multer')

const app = express()
const port = 3000

// informasi menggunakan EJS
app.use(expressLayouts);

// meng-set layout  dan view engine
app.set('view engine', 'ejs');

// creating 24 hours from milliseconds
const oneDay = 1000 * 60 * 60 * 24;

// konfigurasi session
app.use(
  session({
    secret: 'secret',
    cookie: { maxAge: oneDay },
    resave: false,
    saveUninitialized: false
  })
);

// konfigurasi multer
const storage  = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, 'profile' + '-' + Date.now() + '-' + file.originalname)
  }
})

// konfigurasi multer
const upload = multer({storage: storage });

app.use(flash());

// // menggunakan morgan dev untuk menampilkan info log
// app.use(morgan('dev'));

// menggunakan express static untuk memberi izin terhadap folder public
app.use(express.static('public'));

app.use(express.json());  
app.use(express.urlencoded({extended: true}));

app.use(cookieParser());

app.use('/', async (req, res, next) => {
  // mendapatkan url dan method
  const url = req.url
  const method = req.method
  
  // memasukan req.session kedalam variable
  var session = req.session
  console.log(session);

  // jika name dan role undefined
  if (session.userid === undefined && session.role === undefined) {
    session.userid = "guest"
    session.role = "guest"
  } else {
    session.userid
    session.role
  }

  console.log(`${method} ${url} ${session.userid} ${session.role} ${Date()}`)

  // memasukkan semua request kedalam database
  await pool.query(`INSERT INTO log (username, role, action, url, date, action_time) VALUES 
  ('${session.userid}', '${session.role}', '${method}', '${url}', CURRENT_DATE, NOW())`)

  next()
})

// mendapatkan route login
app.get('/', (req, res) => {
  res.redirect('/login');
})

// mendapatkan route login
app.get('/login', (req, res) => {
  const session = req.session

  console.log(req.session);

  if (session.userid && session.role === 'user') {
    res.redirect('/user/dashboard')
  }

  if (session.userid && session.role === 'admin') {
    res.redirect('/admin/dashboard')
  }

  if (session.userid && session.role === 'superadmin') {
    res.redirect('/superadmin/dashboard')
  }

  res.render('login',
  {
    title: "Login Page",
    layout: "./layout/layout.ejs",
    msg: req.flash('msg'),
    msg2: req.flash('msg2'),
  })
})

// proses login
app.post('/login', async (req, res) => {
  try {
    // query untuk mencari nama
    const foundUser = await pool.query(`SELECT * FROM users WHERE username = '${ req.body.username}'`)
    // jika ada
    if (foundUser.rows.length === 0) {
      // pesan flash
      req.flash('msg', `Username or Password Invalid !`);
      // mengalihkan kembali ke halaman contact
      res.redirect("/login")
    }
    // query untuk menyocokan password
    const hashedPassword = await bcrypt.compare(req.body.password, foundUser.rows[0].password)
    // jika salah
    if (hashedPassword === false) {
      // pesan flash
      req.flash('msg', `Username or Password Invalid !`);
      // mengalihkan kembali ke halaman contact
      res.redirect("/login")
    }
    // jika terpenuhi semua
    if (foundUser && hashedPassword) {
      var session = req.session;
      session.userid = foundUser.rows[0].username;
      session.role = foundUser.rows[0].role;

      console.log(req.session)

      // jika terdapat session dengan user id dan role user
      if (session.userid && session.role === 'user') {
        // pesan flash
        req.flash('msg3',`Welcome Back ${session.userid} !`);
        // mengalihkan ke halaman user
        res.redirect("/user/dashboard")
      } 
      if (session.userid && session.role === 'admin') {
        // pesan flash
        req.flash('msg3', `Welcome Back ${session.userid} !`);
        // mengalihkan ke halaman superadmin
        res.redirect("/admin/dashboard")
      } 
      if (session.userid && session.role === 'superadmin') {
        // pesan flash
        req.flash('msg3', `Welcome Back ${session.userid} !`);
        // mengalihkan ke halaman superadmin
        res.redirect("/superadmin/dashboard")
      } 
    } 
  } catch (err) {
    console.log(err.message);
  }
})

// memanggil halaman superadmin/dashboard
app.get('/superadmin/dashboard', async (req,res) => {

  // memanggil semua data karyawan yang ada di database
  const sql = "SELECT * FROM users WHERE role IN('admin', 'user') ORDER BY username ASC"

  // menghitung seluruh data karyawan
  const count = await pool.query(`SELECT COUNT(username) FROM users WHERE role IN('admin','user')`)

  // menghitung data karyawan dengan role admin
  const countAdmin = await countEmployeeAdmin(sql);

  // menghitung data karyawan dengan role user
  const countUser = await countEmployeeUser(sql);

  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      console.log(err.message)
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'superadmin') {
      req.flash('msg2', `You Must Login as Superadmin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/superadmin/dashboard', {
        page_name: 'superadmin/dashboard',
        title: "Dashboard Superadmin",
        layout: "./layout/superadmin/layout.ejs",
        count: count.rows[0],
        countAdmin,
        countUser,
        model: result.rows,
        model2: user.rows[0],
        session,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

// memanggil halaman superadmin/add-employee
app.get('/superadmin/add-employee', async (req,res) => {

  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }
  if (session.userid) {
    res.render('./layout/superadmin/add-employee', 
    { 
      page_name: 'superadmin/add-employee',
      title: "Add Contact Page",
      layout: "./layout/superadmin/layout.ejs",
      session,
      model: {},
      model2: user.rows[0]
    })
  }
})

// proses tambah pegawai 
app.post('/employee/add', upload.array('uploadImage', 1), [
  body('name').custom(async(value) => {
    console.log(value);

    // mencari nama yang sama
    const queryDuplicate = await pool.query(`SELECT username FROM users WHERE username='${value.toLowerCase()}';`)
    const duplicate = queryDuplicate.rows[0]

    // jika sama
    if (duplicate) {
      throw new Error(`${ value } Name is already exist, Use another name`)
    } else {
      return true;
    }
  }),
  check('name', 'Name Field Must Not Empty').notEmpty(),
  check('password', 'Password Field Must Not Empty').notEmpty(),
  check('confirmPassword', 'Confirm Password Field Must Not Empty').notEmpty(),
  check('role', 'Select a Role').isIn(['admin']),
  check('password','password must contained min 6 character').isLength({min: 6}),
  body('password').custom((value, {req}) => {
    if (value !== req.body.confirmPassword) {
      throw new Error(`Please Enter The Same Password`)
    } else {
      return true;
    }
  }),
], async (req,res) => {

  var session = req.session;

  console.log(req.session)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('./layout/superadmin/add-employee', 
      { 
        page_name: 'superadmin/add-employee',
        title: "Add Employee",
        errors: errors.array(),
        model2: user.rows[0],
        layout: "./layout/superadmin/layout.ejs",
        session,
        params: req.body
      })
    } else {

      const name = req.body.name.toLowerCase().trim()
      const password = req.body.password
      const passwordHashed = bcrypt.hashSync(password, 10)
      const role = req.body.role
      let photo
      console.log(req.files[0]);

      if (!req.files.find((inputPhoto) => inputPhoto.filename)) {
        photo = "default.jpg"
      } else {
        photo = req.files[0].filename
      }

      // melakukan query insert ke database
      const newEmployee = await pool.query(`INSERT INTO users (username, password, role, photo) VALUES('${name.toLowerCase()}','${passwordHashed}','${role}', '${photo}') RETURNING *`)
      newEmployee;
  
      // pesan flash
      req.flash('msg', `Employee's Added !`);
  
      // mengalihkan kembali ke halaman contact
      res.redirect("/superadmin/dashboard")
    }
  }
});

// mendapatkan halaman edit pegawai berdasarkan nama yang dipilih
app.get('/superadmin/edit-employee/:name', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  const name = req.params.name;
  const sql = `SELECT * FROM users WHERE username = '${name}'`;

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)


  pool.query(sql, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'superadmin') {
      req.flash('msg2', `You Must Login as Superadmin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/superadmin/edit-employee', 
      { 
        page_name: 'superadmin/edit-employee',
        title: "Edit Employee Page",
        session,
        model: result.rows[0],
        model2: user.rows[0],
        layout: "./layout/superadmin/layout.ejs",
      })
    }
  })
});

// mengpost data pegawai yang sudah dirubah
app.post('/employee/update-superadmin', [
  body('name').custom(async(value, {req}) => {
    console.log(value);

    // mencari nama yang sama
    const queryDuplicate = await pool.query(`SELECT username FROM users WHERE username='${value.toLowerCase()}';`)
    const duplicate = queryDuplicate.rows[0]

    console.log(duplicate);

    // jika sama
    if (duplicate) {
      throw new Error(`${ value } Name is already exist, Use another name`)
    } else {
      return true;
    }
  }),
  check('role', 'Select a Role').isIn(['admin', 'user']),
  check('name', 'Field Username Must Not Be Empty').notEmpty(),
], async (req, res) => {
  var session = req.session;

  console.log(req.session);

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    console.log('1')
    const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)
    const sql = `SELECT * FROM users WHERE username = '${req.body.name}'`;
    console.log(req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('2')
      res.render('./layout/superadmin/edit-employee', 
      { 
        page_name: 'superadmin/edit-employee',
        title: "Edit Employee Page",
        session,
        model: sql.rows,
        model2: user.rows[0],
        errors: errors.array(),
        params: req.body.oldName,
        layout: "./layout/superadmin/layout.ejs",
      })
    } else {
        console.log('3');
        const oldName = req.body.oldName.toLowerCase()
        const name = req.body.name.toLowerCase().trim()
        const role = req.body.role

        const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${oldName}'`)
        console.log(checkData.rows[0].userabsen);
        let query
        
        if (checkData.rows[0].userabsen === null && checkData.rows[0].userlog === null) {
          query = `UPDATE users SET username='${name}', role='${role}' WHERE username='${oldName}'`
        } else {
          query = `WITH UsernameToUpdate AS (
            SELECT users.username FROM users 
            INNER JOIN attendances 
            on users.username = attendances.username
            WHERE users.username='${oldName}'
        ),
            UsernamedUpdated as (
            UPDATE attendances SET username='${name}' WHERE username IN(SELECT username FROM UsernameToUpdate)
        ),
            LogUpdated as (
            UPDATE log SET username='${name}' WHERE username IN(SELECT username FROM UsernameToUpdate)
        )
        UPDATE users SET username='${name}', role='${role}' WHERE username IN(SELECT username FROM UsernameToUpdate)`
        }

        const updateEmployee = await pool.query(query)
        updateEmployee
  
        // pesan flash
        req.flash('msg', `Employees's Data Updated !`);
  
        // mengalihkan kembali ke halaman contact
        res.redirect("/superadmin/dashboard")
      }
  }
})

// memproses delete data pegawai berdasarkan nama
app.get('/superadmin/delete-employee/:name',async (req, res) => {
  var session = req.session;
  
  console.log(req.session)

  // mendapatkan nama dan memasukkan ke variable getContact
  const findEmployee = await getEmployee(req.params.name)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${req.params.name}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if(!findEmployee) {
    // pesan flash
    req.flash('msg2', `Employee's Not Found !`);
    // mengalihkan kembali ke halaman contact
    res.redirect("/superadmin/dashboard")
  } else {

    if (user.rows[0].photo === null || user.rows[0].photo === 'default.jpg') {
      const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${req.params.name}'`)
      console.log(checkData.rows[0].userabsen);
      let query

      if (checkData.rows[0].userabsen === null && checkData.rows[0].userlog === null) {
        query = `DELETE FROM users WHERE username='${req.params.name}'`
      } else {
        query = `WITH UsernameToDelete AS (
          SELECT users.username FROM users 
          INNER JOIN attendances 
          on users.username = attendances.username
          WHERE users.username = '${req.params.name}'
      ),
      UsernamedDeleted as (
          DELETE FROM attendances WHERE username IN(SELECT * FROM UsernameToDelete)
      ),
      LogDelete as (
        DELETE FROM log WHERE username IN(SELECT * FROM UsernameToDelete)
      )
      DELETE FROM users WHERE username IN(SELECT * FROM UsernameToDelete)`
      }
      const deleteEmployee = await pool.query(query);
      deleteEmployee
    } else {
      fs.unlinkSync(`public/uploads/${user.rows[0].photo}`)
      const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${req.params.name}'`)
      console.log(checkData.rows[0].userabsen);
      let query

      if (checkData.rows[0].userbasen === null && checkData.rows[0].userlog === null) {
        query = `DELETE FROM users WHERE username='${req.params.name}'`
      } else {
        query = `WITH UsernameToDelete AS (
          SELECT users.username FROM users 
          INNER JOIN attendances 
          on users.username = attendances.username
          WHERE users.username = '${req.params.name}'
      ),
      UsernamedDeleted as (
          DELETE FROM attendances WHERE username IN(SELECT * FROM UsernameToDelete)
      ),
      LogDelete as (
        DELETE FROM log WHERE username IN(SELECT * FROM UsernameToDelete)
      )
      DELETE FROM users WHERE username IN(SELECT * FROM UsernameToDelete)`
      }
      const deleteEmployee = await pool.query(query);
      deleteEmployee
    }

    // pesan flash
    req.flash('msg', `Employee's Has Been Deleted`);

    // mengalihkan kembali ke halaman contact
    res.redirect("/superadmin/dashboard")
  }
})

// memanggil halaman superadmin/absences
app.get('/superadmin/absences', async (req,res) => {

  // memanggil semua data karyawan yang ada di database
  const sql = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') as total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE role IN ('user', 'admin') ORDER BY date DESC,time_in DESC`
  var session = req.session;
  
  console.log(req.session)
  
  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'superadmin') {
      req.flash('msg2', `You Must Login as Superadmin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/superadmin/absences', {
        page_name: 'superadmin/absences',
        title: "Absences List Page",
        layout: "./layout/superadmin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2')
      })
    }
  })
})

// mengproses filter absensi berdasarkan tanggal dan jam kerja
app.post('/filter-attendance-superadmin', async (req,res) => {
  var session = req.session;
  
  console.log(req.session)

  let {date1, date2, total_hours, hours} = req.body

  if (hours === '9 Hours') {
    hours = '09:00:00'
    console.log(hours);
  }

  let query = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') AS total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE date >='${date1}' AND date <='${date2}'`

  if (total_hours == 'less') {
    query = query + ` AND to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') <= '${hours}'`
  }else if (total_hours == 'more') {
    query = query + ` AND to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') >= '${hours}' `
  }
  query = query + ` ORDER BY date DESC,time_in DESC`

  console.log(query);

  const filterAttendance = await pool.query(query)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/superadmin/absences',{ 
      page_name: 'superadmin/absences',
      title:'Absences List Page',
      layout: "./layout/superadmin/layout.ejs",
      model: filterAttendance.rows,
      model2: user.rows[0],
      date1,date2,total_hours,hours,
      msg : req.flash('msg'),
      moment,
      msg2 : req.flash('msg2'),
      session,
    })
  }
})

// memanggil halaman superadmin/app-log
app.get('/superadmin/app-log', async (req,res) => {

  // memanggil semua data karyawan yang ada di database
  const sql = `SELECT * FROM log ORDER BY date DESC,action_time DESC`
  var session = req.session;
  
  console.log(req.session)
  
  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'superadmin') {
      req.flash('msg2', `You Must Login as Superadmin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/superadmin/log', {
        page_name: 'superadmin/app-log',
        title: "App Log List Page",
        layout: "./layout/superadmin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2')
      })
    }
  })
})

// mengproses filter log berdasarkan tanggal yang diinput
app.post('/filter-log-superadmin', async (req,res) => {
  var session = req.session;
  
  console.log(req.session)

  let {date1, date2, role} = req.body

  let query = `SELECT * FROM log WHERE date >='${date1}' AND date <='${date2}'`

  if (role == 'superadmin') {
    query = query + ` AND role IN('superadmin')`
  } else if (role == 'admin') {
    query = query + ` AND role IN('admin')`
  } else if (role == 'user') {
    query = query + ` AND role IN('user')`
  } else {
    query = query + ` ORDER BY date DESC,action_time DESC`
  }

  console.log(query);

  const filterAttendance = await pool.query(query)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/superadmin/log',{ 
      page_name: 'superadmin/app-log',
      title:'App Log List Page',
      layout: "./layout/superadmin/layout.ejs",
      model: filterAttendance.rows,
      model2: user.rows[0],
      date1,
      date2,
      role,
      msg : req.flash('msg'),
      moment,
      msg2 : req.flash('msg2'),
      session,
    })
  }
})

app.get('/superadmin/profile/:name', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  req.params.name = session.userid
  const name = req.params.name

  console.log(name);

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  const profile = await pool.query(`SELECT * FROM users where username = '${name}'`)

  console.log(profile.rows.length);

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/superadmin/profile', 
    { 
      page_name: 'superadmin/profile',
      title: "Profile Page",
      layout: "./layout/superadmin/layout.ejs",
      model: profile.rows[0],
      model2: user.rows[0],
      session,
    })
  }
});

app.post('/employee/update-profile-superadmin', upload.array('uploadImage', 1), async (req, res) => {
  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'superadmin') {
    req.flash('msg2', `You Must Login as Superadmin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('1');
      res.render('./layout/superadmin/profile', 
      { 
        page_name: 'superadmin/profile',
        title: "Profile Page",
        errors: errors.array(),
        model,
        model2: user.rows[0],
        params: req.body
      })
    } else {
        console.log('2');
        let photo

        if (user.rows[0].photo === null || user.rows[0].photo === 'default.jpg') {
          photo = req.files[0].filename
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        } else {
          fs.unlinkSync(`public/uploads/${user.rows[0].photo}`)
          photo = req.files[0].filename
          // melakukan query update ke database
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        }

        // pesan flash
        req.flash('msg', `profile's Updated !`);
  
        // mengalihkan kembali ke halaman contact
        res.redirect("/superadmin/dashboard")
    }
  }
});

// memanggil halaman admin/dashboard
app.get('/admin/dashboard', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  // memanggil semua data karyawan yang ada di database
  const sql = "SELECT * FROM users WHERE role='user' ORDER BY username ASC"

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  // menghitung data karyawan dengan role user
  const countUser = await countEmployeeUser(sql);

  const countCompleted = await countAttendanceCompleted();

  const countUncompleted = await countAttendanceUncompleted();

  const countIn = await countAttendanceTimeIn()

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/admin/dashboard', {
        page_name: 'admin/dashboard',
        title: "Dashboard Admin",
        layout: "./layout/admin/layout.ejs",
        countUser,
        countCompleted,
        countUncompleted,
        countIn,
        session,
        model: result.rows,
        model2: user.rows[0],
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

app.get('/admin/check-attendance-in', async (req,res) => {

  var session = req.session;
  console.log(req.session);

  // memanggil semua data karyawan yang sudah absen masuk hari ini
  const sql = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') AS total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_in IS NOT null AND attendances.date = CURRENT_DATE AND users.role = 'user' ORDER BY date DESC, time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/admin/attendance-time-in', {
        page_name: 'admin/check-attendance-in',
        title: "Employee Time In Today Check",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

app.get('/admin/check-attendance-uncompleted', async (req,res) => {

  var session = req.session;
  console.log(req.session);

  // memanggil semua data karyawan yang sudah absen masuk hari ini
  const sql = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') AS total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_in IS null OR attendances.time_out IS NULL AND attendances.date = CURRENT_DATE AND users.role = 'user' ORDER BY date DESC, time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/admin/attendance-uncompleted', {
        page_name: 'admin/check-uncompleted',
        title: "Employee Time In Today Check",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

app.get('/admin/check-attendance-completed', async (req,res) => {

  var session = req.session;
  console.log(req.session);

  // memanggil semua data karyawan yang sudah absen masuk hari ini
  const sql = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') AS total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_in IS NOT null AND attendances.time_out IS NOT NULL AND attendances.date = CURRENT_DATE AND users.role = 'user' ORDER BY date DESC, time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/admin/attendance-completed', {
        page_name: 'admin/check-completed',
        title: "Employee Time In Today Check",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

// memanggil halaman superadmin/dashboard
app.get('/admin/history', async (req,res) => {

  var session = req.session;
  
  console.log(req.session)

  // memanggil semua data karyawan yang ada di database
  const sql = `SELECT * FROM attendances WHERE username = '${session.userid}' ORDER BY date DESC, time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/admin/attendance-history', {
        page_name: 'admin/history',
        title: "Admin History Attendance",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})

// memanggil halaman user/attendance
app.get('/admin/add-attendance', async (req,res) => {

  var session = req.session;
  console.log(req.session)

  const attendance = await pool.query(`SELECT * FROM attendances where username = '${session.userid}' and date = 'now()'`)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  console.log(attendance.rows.length);

  let id

  if (attendance.rows.length != 0) {

    id =  attendance.rows[0].id
    console.log(id);
  }

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/admin/attendance-form', 
    { 
      page_name: 'admin/add-attendance',
      title: "Attendance Form Page",
      layout: "./layout/admin/layout.ejs",
      id,
      session,
      model2: user.rows[0],
      model: attendance.rows[0]
    })
  }
})

// memanggil halaman superadmin/absences
app.get('/admin/absences', async (req,res) => {

  // memanggil semua data karyawan yang ada di database
  var session = req.session;
  console.log(req.session)

  const sql = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') as total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE role IN ('user') ORDER BY date DESC,time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/admin/attendance-list', {
        page_name: 'admin/absences',
        title: "Absences List Page",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2')
      })
    }
  })
})

app.post('/filter-attendance-admin', async (req,res) => {
  var session = req.session;
  
  console.log(req.session)

  let {date1, date2, total_hours, hours} = req.body

  if (hours === '9 Hours') {
    hours = '09:00:00'
    console.log(hours);
  }

  let query = `SELECT attendances.id, attendances.username, users.role, attendances.date, attendances.time_in, attendances.time_out, to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') AS total_hours FROM attendances INNER JOIN users ON attendances.username = users.username WHERE date >='${date1}' AND date <='${date2}'`

  if (total_hours == 'less') {
    query = query + ` AND to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') <= '${hours}' AND role IN ('user')`
  }else if (total_hours == 'more') {
    query = query + ` AND to_char(attendances.time_out-attendances.time_in::time,'HH24:MI:ss') >= '${hours}' AND role IN ('user')`
  }
  query = query + ` ORDER BY date DESC,time_in DESC`

  console.log(query);

  const filterAttendance = await pool.query(query)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/admin/attendance-list',{ 
      page_name: 'admin/absences',
      title:'Absences List Page',
      layout: "./layout/admin/layout.ejs",
      model: filterAttendance.rows,
      model2: user.rows[0],
      date1,date2,total_hours,hours,
      msg : req.flash('msg'),
      moment,
      msg2 : req.flash('msg2'),
      session,
    })
  }
})

// proses tambah absensi masuk
app.post('/admin/attendance', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('./layout/admin/add-attendance', 
      { 
        page_name: 'admin/add-attendance',
        title: "Add Admin Attendance",
        errors: errors.array(),
        layout: "./layout/admin/layout.ejs",
        session,
        model2: user.rows[0],
        params: req.body
      })
    } else {
        const id = req.body.id
        let attendance

        if (session.userid && id) {
          attendance = await pool.query(`SELECT * FROM attendances where username='${session.userid}' and date = 'now()' and id='${id}'`)         
        } else {
          attendance = await pool.query(`SELECT * FROM attendances where username='${session.userid}' and date = 'now()'`)
        }
  
        // melakukan query insert ke database
        if (attendance.rows.length == 0) {
          const newAttendance = await pool.query(`INSERT INTO attendances (username, date, time_in) VALUES('${session.userid}', 'now()', 'now()') RETURNING *`)
          newAttendance;

          // flash message
          req.flash('msg3',`Your Attendance Is Submitted, Happy Working ${session.userid} !`)

          // mengalihkan ke halaman user dashboard
          res.redirect('/admin/dashboard')
        } else if (attendance.time_out == null) {
          const updateAttendance = await pool.query(`UPDATE attendances SET time_out = now() WHERE id='${id}' AND username = '${session.userid}'`)
          updateAttendance;

          console.log(updateAttendance)

          // flash message
          req.flash('msg3',`Your Attendance Is Submitted, Go Home Safely ${session.userid} !`)

          // mengalihkan ke halaman user dashboard
          res.redirect('/admin/dashboard')
        } else if (attendance.time_out !== null) {
          // flash message
          req.flash('msg3',`Your Attendance Today Has Been Recorded, Come Again Tommorow!`)
        }
      }
  }
});

// memanggil halaman superadmin/add-employee
app.get('/admin/add-employee', async (req,res) => {

  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/admin/add-employee', 
    { 
      page_name: 'admin/add-employee',
      title: "Add Contact Page",
      layout: "./layout/admin/layout.ejs",
      session,
      model: {},
      model2: user.rows[0],
    })
  }
})

// proses tambah karyawan
app.post('/employee/add-employee', upload.array('uploadImage', 1), [
  body('name').custom(async(value) => {
    console.log(value);

    // mencari nama yang sama
    const queryDuplicate = await pool.query(`SELECT username FROM users WHERE username='${value.toLowerCase()}';`)
    const duplicate = queryDuplicate.rows[0]

    // jika sama
    if (duplicate) {
      throw new Error(`${ value } Name is already exist, Use another name`)
    } else {
      return true;
    }
  }),
  check('name', 'Name Field Must Not Empty').notEmpty(),
  check('password', 'Password Field Must Not Empty').notEmpty(),
  check('confirmPassword', 'Confirm Password Field Must Not Empty').notEmpty(),
  check('role', 'Select a Role').isIn(['superadmin', 'user']),
  check('password','Password Must Contained Min 6 Character').isLength({min: 6}),
  body('password').custom((value, {req}) => {
    if (value !== req.body.confirmPassword) {
      throw new Error(`Please Enter The Same Password`)
    } else {
      return true;
    }
  }),
], async (req,res) => {

  var session = req.session;

  console.log(req.session)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('./layout/admin/add-employee', 
      { 
        page_name: 'admin/add-employee',
        title: "Add Employee",
        errors: errors.array(),
        layout: "./layout/admin/layout.ejs",
        model2: user.rows[0],
        session,
        params: req.body
      })
    } else {

      const name = req.body.name.toLowerCase()
      const password = req.body.password
      const passwordHashed = bcrypt.hashSync(password, 10)
      const role = req.body.role
      let photo
      console.log(req.files[0]);

      if (!req.files.find((inputPhoto) => inputPhoto.filename)) {
        photo = "default.jpg"
      } else {
        photo = req.files[0].filename
      }

      // melakukan query insert ke database
      const newEmployee = await pool.query(`INSERT INTO users (username, password, role, photo) VALUES('${name.toLowerCase()}','${passwordHashed}','${role}', '${photo}') RETURNING *`)
      newEmployee;
  
      // pesan flash
      req.flash('msg', `Employee's Added !`);
  
      // mengalihkan kembali ke halaman contact
      res.redirect("/admin/dashboard")
    }
  }
});

// mengedit karyawan
app.get('/admin/edit-employee/:name', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  const name = req.params.name;
  const sql = `SELECT * FROM users WHERE username = '${name}'`;

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)


  pool.query(sql, (err, result) => {
    if (err) {
      return console.error(err.message);
    }
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as Admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/admin/edit-employee', 
      { 
        page_name: 'admin/edit-employee',
        title: "Edit Employee Page",
        session,
        model: result.rows[0],
        model2: user.rows[0],
        layout: "./layout/admin/layout.ejs",
      })
    }
  })
});

// proses edit 
// mengpost data yang sudah dirubah
app.post('/employee/update-profile', [
  body('name').custom(async(value, { req }) => {
    // mencari nama yang sama
    const queryDuplicate = await pool.query(`SELECT username FROM users WHERE username='${value}';`)
    const duplicate = queryDuplicate.rows[0]

    // jika nama yang diinput tidak sama dengan nama lama dan nama sama
    if ( value !== req.body.oldName && duplicate) {
      throw new Error(`${ value } Sudah Terdaftar, Silahkan Gunakan Nama Lain`)
    } else {
      return true;
    }
  }),
], async (req, res) => {
  var session = req.session;

  console.log(req.session)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('./layout/admin/edit-employee', 
      { 
        page_name: 'admin/edit-employee',
        title: "Edit Employee Page",
        errors: errors.array(),
        params: req.body
      })
    } else {
        const oldName = req.body.oldName.toLowerCase()
        const name = req.body.name.toLowerCase()
  
        const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${oldName}'`)
        console.log(checkData.rows[0].userabsen);
        let query
        
        if (checkData.rows[0].userabsen === null && checkData.rows[0].userlog === null) {
          query = `UPDATE users SET username='${name}' WHERE username='${oldName}'`
        } else {
          query = `WITH UsernameToUpdate AS (
            SELECT users.username FROM users 
            INNER JOIN attendances 
            on users.username = attendances.username
            WHERE users.username='${oldName}'
        ),
            UsernamedUpdated as (
            UPDATE attendances SET username='${name}' WHERE username IN(SELECT username FROM UsernameToUpdate)
        ),
            LogUpdated as (
            UPDATE log SET username='${name}' WHERE username IN(SELECT username FROM UsernameToUpdate)
        )
        UPDATE users SET username='${name}' WHERE username IN(SELECT username FROM UsernameToUpdate)`
        }

        const updateEmployee = await pool.query(query)
        updateEmployee
  
        // pesan flash
        req.flash('msg', `Employees's Data Updated !`);
  
        // mengalihkan kembali ke halaman contact
        res.redirect("/admin/dashboard")
      }
  }
})

app.get('/admin/delete-employee/:name', async (req, res) => {
  var session = req.session;
  console.log(req.session)
  // mendapatkan nama dan memasukkan ke variable getContact
  const findEmployee = await getEmployee(req.params.name)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${req.params.name}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if(!findEmployee) {
    // pesan flash
    req.flash('msg2', `Employee's Not Found !`);
    // mengalihkan kembali ke halaman contact
    res.redirect("/admin/dashboard")
  } else {

    if (user.rows[0].photo === null || user.rows[0].photo === 'default.jpg') {
      const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${req.params.name}'`)
      console.log(checkData.rows[0].userabsen);
      let query

      if (checkData.rows[0].userbasen === null && checkData.rows[0].userlog === null) {
        query = `DELETE FROM users WHERE username='${req.params.name}'`
      } else {
        query = `WITH UsernameToDelete AS (
          SELECT users.username FROM users 
          INNER JOIN attendances 
          on users.username = attendances.username
          WHERE users.username = '${req.params.name}'
      ),
      UsernamedDeleted as (
          DELETE FROM attendances WHERE username IN(SELECT * FROM UsernameToDelete)
      ),
      LogDelete as (
        DELETE FROM log WHERE username IN(SELECT * FROM UsernameToDelete)
      )
      DELETE FROM users WHERE username IN(SELECT * FROM UsernameToDelete)`
      }
      const deleteEmployee = await pool.query(query);
      deleteEmployee
    } else {
      fs.unlinkSync(`public/uploads/${user.rows[0].photo}`)
      const checkData = await pool.query(`SELECT users.username, users.role, attendances.date, attendances.time_in, attendances.time_out, attendances.username AS userabsen, log.username AS userlog FROM users LEFT JOIN attendances ON users.username = attendances.username LEFT JOIN log ON attendances.username = log.username WHERE users.username='${req.params.name}'`)
      console.log(checkData.rows[0].userabsen);
      let query

      if (checkData.rows[0].userbasen === null && checkData.rows[0].userlog === null) {
        query = `DELETE FROM users WHERE username='${req.params.name}'`
      } else {
        query = `WITH UsernameToDelete AS (
          SELECT users.username FROM users 
          INNER JOIN attendances 
          on users.username = attendances.username
          WHERE users.username = '${req.params.name}'
      ),
      UsernamedDeleted as (
          DELETE FROM attendances WHERE username IN(SELECT * FROM UsernameToDelete)
      ),
      LogDelete as (
        DELETE FROM log WHERE username IN(SELECT * FROM UsernameToDelete)
      )
      DELETE FROM users WHERE username IN(SELECT * FROM UsernameToDelete)`
      }
      const deleteEmployee = await pool.query(query);
      deleteEmployee
    }

    // pesan flash
    req.flash('msg', `Employee's Has Been Deleted`);

    // mengalihkan kembali ke halaman contact
    res.redirect("/admin/dashboard")
  }
})

// memanggil halaman superadmin/absences
app.get('/admin/app-log', async (req,res) => {

  // memanggil semua data karyawan yang ada di database
  const sql = `SELECT * FROM log ORDER BY date DESC,action_time DESC`
  var session = req.session;
  
  console.log(req.session)
  
  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'admin') {
      req.flash('msg2', `You Must Login as admin !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('./layout/admin/log', {
        page_name: 'admin/app-log',
        title: "App Log List Page",
        layout: "./layout/admin/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2')
      })
    }
  })
})

app.post('/filter-log-admin', async (req,res) => {
  var session = req.session;
  
  console.log(req.session)

  let {date1, date2, role} = req.body

  let query = `SELECT * FROM log WHERE date >='${date1}' AND date <='${date2}'`

  if (role == 'superadmin') {
    query = query + ` AND role IN('superadmin')`
  } else if (role == 'admin') {
    query = query + ` AND role IN('admin')`
  } else if (role == 'user') {
    query = query + ` AND role IN('user')`
  } else {
    query = query + ` ORDER BY date DESC,action_time DESC`
  }

  console.log(query);

  const filterAttendance = await pool.query(query)

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/admin/log',{ 
      page_name: 'admin/app-log',
      title:'App Log List Page',
      layout: "./layout/admin/layout.ejs",
      model: filterAttendance.rows,
      model2: user.rows[0],
      date1,
      date2,
      role,
      msg : req.flash('msg'),
      moment,
      msg2 : req.flash('msg2'),
      session,
    })
  }
})

app.get('/admin/profile/:name', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  req.params.name = session.userid
  const name = req.params.name

  console.log(name);

  const user = await pool.query(`SELECT * FROM users where username = '${session.userid}'`)

  const profile = await pool.query(`SELECT * FROM users where username = '${name}'`)

  console.log(profile.rows.length);

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/admin/profile', 
    { 
      page_name: 'admin/profile',
      title: "Profile Page",
      layout: "./layout/admin/layout.ejs",
      model: profile.rows[0],
      model2: user.rows[0],
      session,
    })
  }
});

app.post('/employee/update-profile-admin', upload.array('uploadImage', 1), async (req, res) => {
  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'admin') {
    req.flash('msg2', `You Must Login as Admin !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('1');
      res.render('./layout/admin/profile', 
      { 
        page_name: 'admin/profile',
        title: "Profile Page",
        errors: errors.array(),
        model,
        model2: user.rows[0],
        params: req.body
      })
    } else {
        console.log('2');
        let photo

        if (user.rows[0].photo === null || user.rows[0].photo === 'default.jpg') {
          photo = req.files[0].filename
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        } else {
          fs.unlinkSync(`public/uploads/${user.rows[0].photo}`)
          photo = req.files[0].filename
          // melakukan query update ke database
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        }

        // pesan flash
        req.flash('msg', `profile's Updated !`);
  
        // mengalihkan kembali ke halaman contact
        res.redirect("/admin/dashboard")
    }
  }
});

// memanggil halaman superadmin/dashboard
app.get('/user/dashboard', async (req,res) => {

  var session = req.session;
  
  console.log(req.session)

  // memanggil semua data karyawan yang ada di database
  const sql = `SELECT * FROM attendances WHERE username = '${session.userid}' ORDER BY date DESC, time_in DESC`

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  pool.query(sql, [], (err, result) => {
    if (err) {
      return console.error(err.message);
    } 
    if(!session.userid) {
      req.flash('msg', `You Must Login First !`);
      res.redirect('/login')
    }
    if(session.role !== 'user') {
      req.flash('msg2', `You Must Login as User !`);
      res.redirect('/login')
    }
    if (session.userid) {
      res.render('layout/user/dashboard', {
        page_name: 'user/dashboard',
        title: "Dashboard User",
        layout: "./layout/User/layout.ejs",
        model: result.rows,
        model2: user.rows[0],
        session,
        moment,
        msg: req.flash('msg'),
        msg2: req.flash('msg2'),
        msg3: req.flash('msg3')
      })
    }
  })
})


// memanggil halaman user/attendance
app.get('/user/add-attendance', async (req,res) => {

  var session = req.session;
  console.log(req.session)

  const attendance = await pool.query(`SELECT * FROM attendances where username = '${session.userid}' and date = 'now()'`)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  console.log(attendance.rows.length);

  let id

  if (attendance.rows.length != 0) {

    id =  attendance.rows[0].id
    console.log(id);
  }

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'user') {
    req.flash('msg2', `You Must Login as User !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/user/attendance-form', 
    { 
      page_name: 'user/attendance-form',
      title: "Attendance Form Page",
      layout: "./layout/user/layout.ejs",
      id,
      session,
      model2: user.rows[0],
      model: attendance.rows[0]
    })
  }
})

// proses tambah absensi masuk
app.post('/employee/attendance', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'user') {
    req.flash('msg2', `You Must Login as User !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.render('./layout/user/add-attendance', 
      { 
        page_name: 'user/attendance-form',
        title: "Add Employee Attendance",
        errors: errors.array(),
        layout: "./layout/user/layout.ejs",
        session,
        model2: user.rows[0],
        params: req.body
      })
    } else {
        const id = req.body.id
        let attendance

        if (session.userid && id) {
          attendance = await pool.query(`SELECT * FROM attendances where username='${session.userid}' and date = 'now()' and id='${id}'`)         
        } else {
          attendance = await pool.query(`SELECT * FROM attendances where username='${session.userid}' and date = 'now()'`)
        }
  
        // melakukan query insert ke database
        if (attendance.rows.length == 0) {
          const newAttendance = await pool.query(`INSERT INTO attendances (username, date, time_in) VALUES('${session.userid}', 'now()', 'now()') RETURNING *`)
          newAttendance;

          // flash message
          req.flash('msg3',`Your Attendance Is Submitted, Happy Working ${session.userid} !`)

          // mengalihkan ke halaman user dashboard
          res.redirect('/user/dashboard')
        } else if (attendance.time_out == null) {
          const updateAttendance = await pool.query(`UPDATE attendances SET time_out = now() WHERE id='${id}' AND username = '${session.userid}'`)
          updateAttendance;

          console.log(updateAttendance)

          // flash message
          req.flash('msg3',`Your Attendance Is Submitted, Go Home Safely ${session.userid} !`)

          // mengalihkan ke halaman user dashboard
          res.redirect('/user/dashboard')
        } else if (attendance.time_out !== null) {
          // flash message
          req.flash('msg3',`Your Attendance Today Has Been Recorded, Come Again Tommorow!`)
        }
      }
  }
});

app.get('/user/profile/:name', async (req,res) => {
  var session = req.session;
  console.log(req.session)

  req.params.name = session.userid
  const name = req.params.name

  console.log(name);

  const profile = await pool.query(`SELECT * FROM users where username = '${name}'`)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  console.log(profile.rows.length);

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'user') {
    req.flash('msg2', `You Must Login as User !`);
    res.redirect('/login')
  }

  if (session.userid) {
    res.render('./layout/user/profile', 
    { 
      page_name: 'user/profile',
      title: "Profile Page",
      layout: "./layout/user/layout.ejs",
      session,
      model2: user.rows[0],
      model: profile.rows[0]
    })
  }
});

app.post('/employee/update-profile-user', upload.array('uploadImage', 1), async (req, res) => {
  var session = req.session;

  console.log(req.session)

  const user = await pool.query(`SELECT * FROM users WHERE username = '${session.userid}'`)

  if(!session.userid) {
    req.flash('msg', `You Must Login First !`);
    res.redirect('/login')
  }
  if(session.role !== 'user') {
    req.flash('msg2', `You Must Login as User !`);
    res.redirect('/login')
  }

  if (session.userid) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('1');
      res.render('./layout/user/profile', 
      { 
        page_name: 'user/profile',
        title: "Profile Page",
        errors: errors.array(),
        model,
        params: req.body
      })
    } else {
        console.log('2');
        let photo

        if (user.rows[0].photo === undefined || user.rows[0].photo === 'default.jpg') {
          photo = req.files[0].filename
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        } else {
          fs.unlinkSync(`public/uploads/${user.rows[0].photo}`)
          photo = req.files[0].filename
          // melakukan query update ke database
          const updatedProfile = await pool.query(`UPDATE users SET photo='${photo}' WHERE username='${session.userid}'`)
          updatedProfile;
        }

        // pesan flash
        req.flash('msg', `profile's Updated !`);
  
        // mengalihkan kembali ke halaman contact
        res.redirect("/user/dashboard")
    }
  }
});

app.get('/logout',(req,res) => {
  var session = req.session;
  console.log(req.session);
  session.destroy((err) => {
    if(err) {
        return console.log(err);
    }
    res.redirect('/');
  });
});

app.listen(port, () => {
  console.log(`Employee Absence App Listening on Port ${port}`)
})

// error jika tidak ada route yang terdaftar
app.use('/', (req, res) => {
  res.status(404)
  res.send('Page Not Found : 404')
})

const getEmployee = async (value) => {
  const name = value
  const employee = await pool.query(`SELECT username from users where username='${name}'`)
  return employee.rows[0]
}

// menghitung seluruh jumlah karyawan
const countEmployee = async () => {
  const count = await pool.query(`SELECT COUNT(username) FROM users`)
  return count.rows[0]
}

// menghitung seluruh jumlah karyawan dengan role admin
const countEmployeeAdmin = async () => {
  const count = await pool.query(`SELECT COUNT(username) FROM users WHERE role='admin'`)
  return count.rows[0]
}

// menghitung seluruh jumlah karyawan dengan role user
const countEmployeeUser = async () => {
  const count = await pool.query(`SELECT COUNT(username) FROM users WHERE role='user'`)
  return count.rows[0]
}

const countAttendanceTimeIn = async () => {
  const count = await pool.query(`SELECT COUNT (attendances.username) FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_in IS NOT null AND attendances.date = CURRENT_DATE AND users.role = 'user'`)
  return count.rows[0]
}

const countAttendanceUncompleted = async () => {
  const count = await pool.query(`SELECT COUNT (attendances.username) FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_in IS null OR attendances.time_out IS null AND attendances.date = CURRENT_DATE AND users.role = 'user'`)
  return count.rows[0]
}

const countAttendanceCompleted = async () => {
  const count = await pool.query(`SELECT COUNT (attendances.username) FROM attendances INNER JOIN users ON attendances.username = users.username WHERE attendances.time_out IS NOT null AND attendances.time_in IS NOT null AND attendances.date = CURRENT_DATE AND users.role = 'user'`)
  return count.rows[0]
}
