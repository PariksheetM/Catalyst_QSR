const { execSync } = require('child_process')

const env = process.env
const DB_USER = env.DB_USER || 'root'
const DB_PASSWORD = env.DB_PASSWORD || ''
const DB_HOST = env.DB_HOST || 'localhost'
const DB_PORT = env.DB_PORT || '3306'

// Build mysql command. Note: input redirection requires shell
const passwordPart = DB_PASSWORD ? `-p${DB_PASSWORD}` : ''
const cmd = `mysql -u ${DB_USER} ${passwordPart} -h ${DB_HOST} -P ${DB_PORT} < migrations.sql`

console.log('Running migrations via:', cmd.replace(DB_PASSWORD, '********'))
execSync(cmd, { stdio: 'inherit', cwd: __dirname + '/..' })
