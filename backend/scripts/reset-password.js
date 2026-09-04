const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("❌ Uso: node scripts/reset-password.js <email> <nueva-contraseña>");
    console.log("   Ejemplo: node scripts/reset-password.js davidchipaco@gmail.com admin123");
    process.exit(1);
  }

  const [email, newPassword] = args;
  if (newPassword.length < 4) {
    console.log("❌ La contraseña debe tener al menos 4 caracteres");
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "sistema_losa",
    });

    const [rows] = await connection.query("SELECT id_t, nombres, email, rol FROM trabajadores WHERE email = ?", [email]);
    if (rows.length === 0) {
      console.log(`❌ No se encontró un trabajador con el email: ${email}`);
      const [all] = await connection.query("SELECT id_t, nombres, email, rol FROM trabajadores");
      for (const t of all) {
        console.log(`   - ${t.email} (${t.nombres} - ${t.rol})`);
      }
      process.exit(1);
    }

    const trabajador = rows[0];
    console.log(`✅ Trabajador encontrado: ${trabajador.nombres} (${trabajador.rol})`);
    console.log(`🔐 Hasheando nueva contraseña...`);
    const hash = await bcrypt.hash(newPassword, 10);
    await connection.query("UPDATE trabajadores SET password = ? WHERE id_t = ?", [hash, trabajador.id_t]);
    console.log(`✅ ¡Contraseña actualizada exitosamente!`);
    console.log(`   Email: ${email}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
