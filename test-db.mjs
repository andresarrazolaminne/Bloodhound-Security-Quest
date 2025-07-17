import { checkDbConnection } from './server/db.ts'; checkDbConnection().then(res => console.log('DB Connected:', res)).catch(err => console.error('DB Error:', err))
