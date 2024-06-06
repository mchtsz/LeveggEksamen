import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import crypto from "crypto";
import cookieParser from "cookie-parser";

// using these have simple commands and functions to use
const prisma = new PrismaClient();
const app = express();
const adminPaths = ["/admin/"];
const teacherPaths = ["/teacher/"];
const studentPaths = ["/student/"];
const apiPaths = ["/api/"];
const restrictedPaths = [
  "/application",
  ...adminPaths,
  ...teacherPaths,
  ...apiPaths,
  ...studentPaths,
];

// important for reading req.body and using static
app.use(cookieParser());

// middleware for checking if user has cookie and if they're admin
app.use(async (req, res, next) => {
  // Exclude '/register' and '/' routes
  const path = req.path;

  if (!restrictedPaths.includes(path)) return next(); // if path is not restricted, continue

  const token = req.cookies.token; // get token from cookie

  if (!token) return res.redirect("/"); // if no token, redirect to register

  // finds user with token
  const user = await prisma.users.findFirst({
    where: {
      token: token,
    },
  });

  if (!user) return res.redirect("/"); // if no user return to register

  // if they ask for admin path and they're not admin, redirect to welcome
  if (adminPaths.includes(path) && !Role.ADMIN) {
    switch (user.role) {
      case Role.TEACHER:
        res.redirect("/teacher");
        break;
      case Role.STUDENT:
        res.redirect("/student");
        break;
      case Role.GUEST:
        res.redirect("/application");
        break;
      default:
        res.redirect("/"); // Redirect to default path if the user's role is not specified in the switch statement
        break;
    }
  }

  next(); // if everything works let them through
});

// using these after middleware so stuff works, these help to read req.body and use pages folder
app.use(express.urlencoded({ extended: false }));
app.use(express.static("pages"));
app.use(express.static("css"));

// function for creating a user
async function createUser() {
  const user = await prisma.users.create({
    data: {
      mail: "test@test.com",
      username: "testUser",
      password: crypto.createHash("sha256").update("Passord01").digest("hex"),
      role: Role.STUDENT,
      personal: {
        create: {
          firstname: "test",
          lastname: "User",
          address: "User street",
          phone: "98979695",
        },
      },
    },
  });

  console.log(user.username + " has been created");

  return user;
}
// function to create an admin
async function createAdmin() {
  const admin = await prisma.users.create({
    data: {
      mail: "admin@test.com",
      username: "admin",
      password: crypto.createHash("sha256").update("Passord01").digest("hex"),
      role: Role.ADMIN,
      personal: {
        create: {
          firstname: "admin",
          lastname: "admin",
          address: "admin street",
          phone: "123456789",
        },
      },
    },
  });

  console.log(`${admin.username} has been created`);

  return admin;
}

// post for login
app.post("/login", async (req, res) => {
  const { mail, password } = req.body;

  const userData = await prisma.users.findFirst({
    where: {
      mail: mail,
      password: crypto.createHash("sha256").update(password).digest("hex"),
    },
  });

  if (userData) {
    const { role, token } = userData;
    res.cookie("token", token);

    switch (role) {
      case Role.ADMIN:
        res.redirect("/admin");
        break;
      case Role.TEACHER:
        res.redirect("/teacher");
        break;
      case Role.STUDENT:
        res.redirect("/student");
        break;
      case Role.GUEST:
        res.redirect("/application");
        break;
    }
  } else {
    res.redirect("/");
  }
});

app.post("/register", async (req, res) => {
  let { firstname, lastname, mail, address, phone, password } = req.body;

  // Transform Norwegian letters
  firstname = firstname
    .replace(/æ/g, "e")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa");
  lastname = lastname.replace(/æ/g, "e").replace(/ø/g, "o").replace(/å/g, "aa");

  let username =
    firstname.substring(0, firstname.length / 2) +
    lastname.substring(lastname.length / 2);

  // Check if username already exists
  let user = await prisma.users.findFirst({
    where: {
      username: username,
    },
  });

  let counter = 1;
  while (user) {
    // If username exists, append an incrementing number
    username = username + counter;
    user = await prisma.users.findFirst({
      where: {
        username: username,
      },
    });
    counter++;
  }

  user = await prisma.users.create({
    data: {
      mail: mail,
      username: username,
      password: crypto.createHash("sha256").update(password).digest("hex"),
      role: Role.GUEST,
      personal: {
        create: {
          firstname: firstname,
          lastname: lastname,
          address: address,
          phone: phone.toString(),
        },
      },
    },
  });

  if (user) {
    res.cookie("token", user.token);
    res.redirect("/application");
  } else {
    res.redirect("/");
  }
});

const pageRoutes = {
  application: (req, res) => {
    res.sendFile(__dirname + "/pages/application.html");
  },
  login: (req, res) => {
    res.sendFile(__dirname + "/pages/login.html");
  },
  adminEdit: (req, res) => {
    res.sendFile(__dirname + "/pages/admin/edit.html");
  },
  adminCreate: (req, res) => {
    res.sendFile(__dirname + "/pages/admin/create.html");
  },
  adminEditID: (req, res) => {
    res.sendFile(__dirname + "/pages/admin/id.html");
  },
  adminManageID: (req, res) => {
    res.sendFile(__dirname + "/pages/admin/manage/id.html");
  },
  adminManageAdd: (req, res) => {
    res.sendFile(__dirname + "/pages/admin/manage/add.html");
  },
};

const apiRoutes = {
  getUsers: async (req, res) => {
    const users = await prisma.users.findMany({
      include: {
        personal: true,
      },
    });
    res.json(users);
  },
  getSpecificUser: async (req, res) => {
    const id = parseInt(req.params.id);
    const user = await prisma.users.findFirst({
      where: {
        id: id,
      },
      include: {
        personal: true,
      },
    });

    res.json(user);
  },
  createUser: async (req, res) => {
    const { firstname, lastname, mail, address, phone, password, role } =
      req.body;

    const user = await prisma.users.create({
      data: {
        mail: mail,
        username:
          firstname.substring(0, firstname.length / 2) +
          lastname.substring(lastname.length / 2),
        password: crypto.createHash("sha256").update(password).digest("hex"),
        role: role,
        personal: {
          create: {
            firstname: firstname,
            lastname: lastname,
            address: address,
            phone: phone.toString(),
          },
        },
      },
    });

    res.redirect("/admin/");
  },
  updateUser: async (req, res) => {
    const {
      token,
      firstname,
      lastname,
      username,
      mail,
      address,
      password,
      role,
      phone,
    } = req.body;

    const hashedPassword = password
      ? crypto.createHash("sha256").update(password).digest("hex")
      : undefined;

    const updateUser = await prisma.users.update({
      where: {
        token: token,
      },
      data: {
        mail: mail,
        username: username,
        password: hashedPassword,
        role: role,
        personal: {
          update: {
            firstname: firstname,
            lastname: lastname,
            address: address,
            phone: phone,
          },
        },
      },
    });

    res.redirect("/admin/edit");
  },
  deleteUser: async (req, res) => {
    const id = parseInt(req.params.id);
    const user = await prisma.users.delete({
      where: {
        id: id,
      },
    });

    res.redirect("/admin/");
  },
};

// get requests for admin
app.get("/application", pageRoutes.application);
app.get("/login", pageRoutes.login);
app.get("/admin/edit", pageRoutes.adminEdit);
app.get("/admin/create", pageRoutes.adminCreate);
app.get("/api/users", apiRoutes.getUsers);
app.get("/admin/edit/:id", pageRoutes.adminEditID);
app.get("/admin/manage/:id", pageRoutes.adminManageID);
app.get("/api/getUser/:id", apiRoutes.getSpecificUser);

// post requests
app.post("/api/createUser", apiRoutes.createUser);
app.post("/api/deleteUser/:id", apiRoutes.deleteUser);
app.post("/api/updateUser/", apiRoutes.updateUser);

// start the server
app.listen(3000, () => {
  console.log(`Server running on port 3000`);
});
