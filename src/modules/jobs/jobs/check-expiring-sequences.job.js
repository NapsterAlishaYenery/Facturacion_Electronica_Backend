// ============================================================
// Job: check-expiring-sequences
//
// Desactiva secuencias NCF cuyo expires_at ya pasó.
// Corre diario a las 00:05 (timezone RD).
//
// Compara expires_at < now() en UTC — sin desfase.
//
// Se monta desde jobs.scheduler.js. Ver Fase 5 Step 5.3.
// ============================================================

const { Op } = require('sequelize');
const { Sequence } = require('../../../models');
const {
    withErrorHandling,
    recordJobAudit
} = require('../jobs.utils');
const logger = require('../../../shared/logs/logger');

const JOB_NAME = 'check-expiring-sequences';

async function runCheckExpiringSequences() {
    const now = new Date();

    const [affected] = await Sequence.update(
        { isActive: false },
        {
            where: {
                isActive: true,
                expiresAt: { [Op.lte]: now }
            }
        }
    );

    if (affected > 0) {
        await recordJobAudit(JOB_NAME, affected, {
            entity: 'sequence'
        });
    }

    logger.debug(`[JOB:${JOB_NAME}] resumen`, { affected });

    return {
        affected,
        entity: 'sequence'
    };
}

module.exports = withErrorHandling(JOB_NAME, runCheckExpiringSequences);
module.exports._raw = runCheckExpiringSequences;
module.exports.JOB_NAME = JOB_NAME;