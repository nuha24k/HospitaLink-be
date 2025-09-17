const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @desc Get all medications with pagination and filtering
 * @route GET /api/web/admin/medications
 * @access Admin only
 */
const getAllMedications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
      isActive = '',
      requiresPrescription = '',
      isControlled = '',
      sortBy = 'genericName',
      sortOrder = 'asc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause for filtering
    const where = {
      ...(search && {
        OR: [
          { genericName: { contains: search, mode: 'insensitive' } },
          { brandName: { contains: search, mode: 'insensitive' } },
          { medicationCode: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } }
        ]
      }),
      ...(category && { category }),
      ...(isActive !== '' && { isActive: isActive === 'true' }),
      ...(requiresPrescription !== '' && { requiresPrescription: requiresPrescription === 'true' }),
      ...(isControlled !== '' && { isControlled: isControlled === 'true' })
    };

    // Get medications with pagination
    const [medications, totalCount] = await Promise.all([
      prisma.medication.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.medication.count({ where })
    ]);

    // Get categories for filter dropdown
    const categories = await prisma.medication.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: { id: true }
    });

    // Calculate stock status for each medication
    const medicationsWithStatus = medications.map(med => ({
      ...med,
      stockStatus: med.stock <= med.minStock ? 'LOW' : 
                   med.stock >= med.maxStock ? 'HIGH' : 'NORMAL',
      stockPercentage: Math.round((med.stock / med.maxStock) * 100)
    }));

    const totalPages = Math.ceil(totalCount / take);

    // Fixed: Use proper raw query for counting low stock medications
    const [lowStockResult] = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "Medication" 
      WHERE "isActive" = true 
      AND "stock" <= "minStock"
    `;

    res.status(200).json({
      success: true,
      message: 'Medications retrieved successfully',
      data: {
        medications: medicationsWithStatus,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: take,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1
        },
        filters: {
          categories: categories.map(cat => ({
            name: cat.category,
            count: cat._count.id
          }))
        },
        summary: {
          total: totalCount,
          active: await prisma.medication.count({ where: { isActive: true } }),
          lowStock: parseInt(lowStockResult.count.toString()),
          prescriptionOnly: await prisma.medication.count({ 
            where: { requiresPrescription: true } 
          }),
          controlled: await prisma.medication.count({ 
            where: { isControlled: true } 
          })
        }
      }
    });

  } catch (error) {
    console.error('Get all medications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get medication by ID
 * @route GET /api/web/admin/medications/:id
 * @access Admin only
 */
const getMedicationById = async (req, res) => {
  try {
    const { id } = req.params;

    const medication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    // Add stock status
    const medicationWithStatus = {
      ...medication,
      stockStatus: medication.stock <= medication.minStock ? 'LOW' : 
                   medication.stock >= medication.maxStock ? 'HIGH' : 'NORMAL',
      stockPercentage: Math.round((medication.stock / medication.maxStock) * 100)
    };

    res.status(200).json({
      success: true,
      message: 'Medication retrieved successfully',
      data: medicationWithStatus
    });

  } catch (error) {
    console.error('Get medication by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Create new medication
 * @route POST /api/web/admin/medications
 * @access Admin only
 */
const createMedication = async (req, res) => {
  try {
    const {
      medicationCode,
      genericName,
      brandName,
      category,
      dosageForm,
      strength,
      unit,
      manufacturer,
      description,
      indications,
      contraindications,
      sideEffects,
      dosageInstructions,
      pricePerUnit,
      stock = 0,
      minStock = 5,
      maxStock = 1000,
      requiresPrescription = true,
      isControlled = false
    } = req.body;

    // Check if medication code already exists
    const existingMedication = await prisma.medication.findUnique({
      where: { medicationCode }
    });

    if (existingMedication) {
      return res.status(400).json({
        success: false,
        message: 'Medication code already exists'
      });
    }

    // Create new medication
    const newMedication = await prisma.medication.create({
      data: {
        medicationCode,
        genericName,
        brandName,
        category,
        dosageForm,
        strength,
        unit,
        manufacturer,
        description,
        indications,
        contraindications,
        sideEffects,
        dosageInstructions,
        pricePerUnit: parseFloat(pricePerUnit),
        stock: parseInt(stock),
        minStock: parseInt(minStock),
        maxStock: parseInt(maxStock),
        requiresPrescription,
        isControlled,
        createdBy: req.user?.id || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Medication created successfully',
      data: newMedication
    });

  } catch (error) {
    console.error('Create medication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Update medication
 * @route PUT /api/web/admin/medications/:id
 * @access Admin only
 */
const updateMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      medicationCode,
      genericName,
      brandName,
      category,
      dosageForm,
      strength,
      unit,
      manufacturer,
      description,
      indications,
      contraindications,
      sideEffects,
      dosageInstructions,
      pricePerUnit,
      stock,
      minStock,
      maxStock,
      requiresPrescription,
      isControlled,
      isActive
    } = req.body;

    // Check if medication exists
    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    // Check if medication code is being changed and already exists
    if (medicationCode && medicationCode !== existingMedication.medicationCode) {
      const duplicateCode = await prisma.medication.findUnique({
        where: { medicationCode }
      });

      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message: 'Medication code already exists'
        });
      }
    }

    // Update medication
    const updatedMedication = await prisma.medication.update({
      where: { id },
      data: {
        ...(medicationCode && { medicationCode }),
        ...(genericName && { genericName }),
        ...(brandName !== undefined && { brandName }),
        ...(category && { category }),
        ...(dosageForm && { dosageForm }),
        ...(strength && { strength }),
        ...(unit && { unit }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(description !== undefined && { description }),
        ...(indications !== undefined && { indications }),
        ...(contraindications !== undefined && { contraindications }),
        ...(sideEffects !== undefined && { sideEffects }),
        ...(dosageInstructions !== undefined && { dosageInstructions }),
        ...(pricePerUnit !== undefined && { pricePerUnit: parseFloat(pricePerUnit) }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(minStock !== undefined && { minStock: parseInt(minStock) }),
        ...(maxStock !== undefined && { maxStock: parseInt(maxStock) }),
        ...(requiresPrescription !== undefined && { requiresPrescription }),
        ...(isControlled !== undefined && { isControlled }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      data: updatedMedication
    });

  } catch (error) {
    console.error('Update medication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Delete medication (soft delete)
 * @route DELETE /api/web/admin/medications/:id
 * @access Admin only
 */
const deleteMedication = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Check if medication exists
    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    if (permanent === 'true') {
      // Permanent delete
      await prisma.medication.delete({
        where: { id }
      });

      res.status(200).json({
        success: true,
        message: 'Medication permanently deleted'
      });
    } else {
      // Soft delete (set isActive to false)
      await prisma.medication.update({
        where: { id },
        data: { isActive: false }
      });

      res.status(200).json({
        success: true,
        message: 'Medication deactivated successfully'
      });
    }

  } catch (error) {
    console.error('Delete medication error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Update medication stock
 * @route PATCH /api/web/admin/medications/:id/stock
 * @access Admin only
 */
const updateMedicationStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

    // Check if medication exists
    const existingMedication = await prisma.medication.findUnique({
      where: { id }
    });

    if (!existingMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }

    let newStock;
    switch (operation) {
      case 'add':
        newStock = existingMedication.stock + parseInt(stock);
        break;
      case 'subtract':
        newStock = Math.max(0, existingMedication.stock - parseInt(stock));
        break;
      default: // 'set'
        newStock = parseInt(stock);
    }

    // Update stock
    const updatedMedication = await prisma.medication.update({
      where: { id },
      data: { stock: newStock }
    });

    res.status(200).json({
      success: true,
      message: 'Medication stock updated successfully',
      data: {
        id: updatedMedication.id,
        genericName: updatedMedication.genericName,
        previousStock: existingMedication.stock,
        newStock: updatedMedication.stock,
        stockStatus: updatedMedication.stock <= updatedMedication.minStock ? 'LOW' : 
                     updatedMedication.stock >= updatedMedication.maxStock ? 'HIGH' : 'NORMAL'
      }
    });

  } catch (error) {
    console.error('Update medication stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication stock',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get low stock medications
 * @route GET /api/web/admin/medications/low-stock
 * @access Admin only
 */
const getLowStockMedications = async (req, res) => {
  try {
    // Fixed: Use proper raw query to compare stock with minStock
    const lowStockMedications = await prisma.$queryRaw`
      SELECT * FROM "Medication" 
      WHERE "isActive" = true 
      AND "stock" <= "minStock"
      ORDER BY "stock" ASC, "genericName" ASC
    `;

    const medicationsWithStatus = lowStockMedications.map(med => ({
      ...med,
      stockStatus: 'LOW',
      stockPercentage: Math.round((med.stock / med.maxStock) * 100),
      daysLeft: Math.ceil(med.stock / (med.maxStock * 0.1)) // Rough estimate
    }));

    res.status(200).json({
      success: true,
      message: 'Low stock medications retrieved successfully',
      data: {
        medications: medicationsWithStatus,
        count: medicationsWithStatus.length
      }
    });

  } catch (error) {
    console.error('Get low stock medications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve low stock medications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * @desc Get medication statistics
 * @route GET /api/web/admin/medications/statistics
 * @access Admin only
 */
const getMedicationStatistics = async (req, res) => {
  try {
    const [
      totalMedications,
      activeMedications,
      inactiveMedications,
      prescriptionOnlyMedications,
      controlledMedications,
      categoryStats,
      stockValueTotal
    ] = await Promise.all([
      prisma.medication.count(),
      prisma.medication.count({ where: { isActive: true } }),
      prisma.medication.count({ where: { isActive: false } }),
      prisma.medication.count({ where: { requiresPrescription: true } }),
      prisma.medication.count({ where: { isControlled: true } }),
      prisma.medication.groupBy({
        by: ['category'],
        _count: { id: true },
        _sum: { stock: true },
        where: { isActive: true }
      }),
      prisma.medication.aggregate({
        _sum: {
          stock: true
        },
        where: { isActive: true }
      })
    ]);

    // Fixed: Get low stock count using raw query
    const [lowStockResult] = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM "Medication" 
      WHERE "isActive" = true 
      AND "stock" <= "minStock"
    `;

    res.status(200).json({
      success: true,
      message: 'Medication statistics retrieved successfully',
      data: {
        overview: {
          total: totalMedications,
          active: activeMedications,
          inactive: inactiveMedications,
          prescriptionOnly: prescriptionOnlyMedications,
          controlled: controlledMedications,
          lowStock: parseInt(lowStockResult.count.toString())
        },
        categories: categoryStats.map(cat => ({
          name: cat.category,
          count: cat._count.id,
          totalStock: cat._sum.stock || 0
        })),
        inventory: {
          totalStockUnits: stockValueTotal._sum.stock || 0
        }
      }
    });

  } catch (error) {
    console.error('Get medication statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medication statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getAllMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  deleteMedication,
  updateMedicationStock,
  getLowStockMedications,
  getMedicationStatistics
};