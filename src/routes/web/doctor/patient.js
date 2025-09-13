const patientController = require('../../../controllers/web/doctor/patientController');

// Add after existing routes
router.get('/patients', patientController.getPatients);
router.get('/patients/search', patientController.searchPatients);