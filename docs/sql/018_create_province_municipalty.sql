-- ============================================================
-- Tabla: provinces
-- Propósito: Provincias DGII (Tabla III, códigos XX0000)
-- ============================================================

CREATE TABLE IF NOT EXISTS provinces (
    dgii_code VARCHAR(6) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT chk_provinces_dgii_code CHECK (dgii_code ~ '^[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_provinces_name ON provinces (name);

COMMENT ON TABLE provinces IS 'Provincias DGII (Tabla III)';
COMMENT ON COLUMN provinces.dgii_code IS 'Código DGII de 6 dígitos (ej: 010000)';
COMMENT ON COLUMN provinces.name IS 'Nombre de la provincia según DGII';


-- ============================================================
-- Tabla: municipalities
-- Propósito: Municipios y Distritos Municipales DGII (Tabla III)
-- ============================================================

CREATE TABLE IF NOT EXISTS municipalities (
    dgii_code VARCHAR(6) PRIMARY KEY,
    province_dgii_code VARCHAR(6) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_district BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT fk_municipalities_province
        FOREIGN KEY (province_dgii_code)
        REFERENCES provinces (dgii_code)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT chk_municipalities_dgii_code CHECK (dgii_code ~ '^[0-9]{6}$')
);

CREATE INDEX IF NOT EXISTS idx_municipalities_province ON municipalities (province_dgii_code);
CREATE INDEX IF NOT EXISTS idx_municipalities_name ON municipalities (name);

COMMENT ON TABLE municipalities IS 'Municipios y distritos municipales DGII (Tabla III)';
COMMENT ON COLUMN municipalities.dgii_code IS 'Código DGII de 6 dígitos (ej: 010100)';
COMMENT ON COLUMN municipalities.province_dgii_code IS 'FK a provinces.dgii_code';
COMMENT ON COLUMN municipalities.is_district IS 'true si es Distrito Municipal (D.M.)';

-- ============================================================
-- INSERT PROVINCIAS
-- ============================================================

INSERT INTO provinces (dgii_code, name) VALUES
('010000', 'DISTRITO NACIONAL'),
('020000', 'PROVINCIA AZUA'),
('030000', 'PROVINCIA BAHORUCO'),
('040000', 'PROVINCIA BARAHONA'),
('050000', 'PROVINCIA DAJABÓN'),
('060000', 'PROVINCIA DUARTE'),
('070000', 'PROVINCIA ELÍAS PIÑA'),
('080000', 'PROVINCIA EL SEIBO'),
('090000', 'PROVINCIA ESPAILLAT'),
('100000', 'PROVINCIA HATO MAYOR'),
('110000', 'PROVINCIA LA ALTAGRACIA'),
('120000', 'PROVINCIA LA ROMANA'),
('130000', 'PROVINCIA LA VEGA'),
('140000', 'PROVINCIA MARÍA TRINIDAD SÁNCHEZ'),
('150000', 'PROVINCIA MONTE CRISTI'),
('160000', 'PROVINCIA PEDERNALES'),
('170000', 'PROVINCIA PERAVIA'),
('180000', 'PROVINCIA PUERTO PLATA'),
('190000', 'PROVINCIA HERMANAS MIRABAL'),
('200000', 'PROVINCIA SAMANÁ'),
('210000', 'PROVINCIA SAN CRISTÓBAL'),
('220000', 'PROVINCIA SAN JUAN'),
('230000', 'PROVINCIA SAN PEDRO DE MACORÍS'),
('240000', 'PROVINCIA SÁNCHEZ RAMÍREZ'),
('250000', 'PROVINCIA SANTIAGO'),
('260000', 'PROVINCIA SANTIAGO RODRÍGUEZ'),
('270000', 'PROVINCIA VALVERDE'),
('280000', 'PROVINCIA MONSEÑOR NOUEL'),
('290000', 'PROVINCIA MONTE PLATA'),
('300000', 'PROVINCIA HATO MAYOR'),
('310000', 'PROVINCIA SAN JOSÉ DE OCOA'),
('320000', 'PROVINCIA SANTO DOMINGO')


select * from provinces
SELECT dgii_code, name FROM provinces ORDER BY dgii_code;

UPDATE provinces
SET name = 'PROVINCIA INDEPENDENCIA'
WHERE dgii_code = '100000';



-- ============================================================
-- INSERT MUNICIPIOS
-- ============================================================

select * from municipalities

INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('010100', '010000', 'MUNICIPIO SANTO DOMINGO DE GUZMÁN', false),
('010101', '010000', 'SANTO DOMINGO DE GUZMÁN (D. M.)', true);

INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES

-- ===== 02 AZUA =====
('020100', '020000', 'MUNICIPIO AZUA', false),
('020101', '020000', 'AZUA (D. M.)', true),
('020102', '020000', 'BARRO ARRIBA (D. M.)', true),
('020103', '020000', 'LAS BARÍAS-LA ESTANCIA (D. M.)', true),
('020104', '020000', 'LOS JOVILLOS (D. M.)', true),
('020105', '020000', 'PUERTO VIEJO (D. M.)', true),
('020106', '020000', 'BARRERAS (D. M.)', true),
('020107', '020000', 'DOÑA EMMA BALAGUER VIUDA VALLEJO (D. M.)', true),
('020108', '020000', 'CLAVELLINA (D. M.)', true),
('020109', '020000', 'LAS LOMAS (D. M.)', true),

('020200', '020000', 'MUNICIPIO LAS CHARCAS', false),
('020201', '020000', 'LAS CHARCAS (D. M.)', true),
('020202', '020000', 'PALMAR DE OCOA (D. M.)', true),

('020300', '020000', 'MUNICIPIO LAS YAYAS DE VIAJAMA', false),
('020301', '020000', 'LAS YAYAS DE VIAJAMA (D. M.)', true),
('020302', '020000', 'VILLARPANDO (D. M.)', true),
('020303', '020000', 'HATO NUEVO CORTÉS (D. M.)', true),

('020400', '020000', 'MUNICIPIO PADRE LAS CASAS', false),
('020401', '020000', 'PADRE LAS CASAS (D. M.)', true),
('020402', '020000', 'LAS LAGUNAS (D. M.)', true),
('020403', '020000', 'LA SIEMBRA (D. M.)', true),
('020404', '020000', 'MONTE BONITO (D. M.)', true),
('020405', '020000', 'LOS FRÍOS (D. M.)', true),

('020500', '020000', 'MUNICIPIO PERALTA', false),
('020501', '020000', 'PERALTA (D. M.)', true),

('020600', '020000', 'MUNICIPIO SABANA YEGUA', false),
('020601', '020000', 'SABANA YEGUA (D. M.)', true),
('020602', '020000', 'PROYECTO 4 (D. M.)', true),
('020603', '020000', 'GANADERO (D. M.)', true),
('020604', '020000', 'PROYECTO 2-C (D. M.)', true),

('020700', '020000', 'MUNICIPIO PUEBLO VIEJO', false),
('020701', '020000', 'PUEBLO VIEJO (D. M.)', true),
('020702', '020000', 'EL ROSARIO (D. M.)', true),

('020800', '020000', 'MUNICIPIO TÁBARA ARRIBA', false),
('020801', '020000', 'TÁBARA ARRIBA (D. M.)', true),
('020802', '020000', 'TÁBARA ABAJO (D. M.)', true),
('020803', '020000', 'AMIAMA GÓMEZ (D. M.)', true),
('020804', '020000', 'LOS TOROS (D. M.)', true),

('020900', '020000', 'MUNICIPIO GUAYABAL', false),
('020901', '020000', 'GUAYABAL (D. M.)', true),

('021000', '020000', 'MUNICIPIO ESTEBANÍA', false),
('021001', '020000', 'ESTEBANÍA (D. M.)', true);

INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES

-- ===== 03 BAHORUCO =====
('030100', '030000', 'MUNICIPIO NEIBA', false),
('030101', '030000', 'NEIBA (D. M.)', true),
('030102', '030000', 'EL PALMAR (D. M.)', true),

('030200', '030000', 'MUNICIPIO GALVÁN', false),
('030201', '030000', 'GALVÁN (D. M.)', true),
('030202', '030000', 'EL SALADO (D. M.)', true),

('030300', '030000', 'MUNICIPIO TAMAYO', false),
('030301', '030000', 'TAMAYO (D. M.)', true),
('030302', '030000', 'UVILLA (D. M.)', true),
('030303', '030000', 'SANTANA (D. M.)', true),
('030304', '030000', 'MONSERRATE (MONTSERRAT) (D. M.)', true),
('030305', '030000', 'CABEZA DE TORO (D. M.)', true),
('030306', '030000', 'MENA (D. M.)', true),
('030307', '030000', 'SANTA BÁRBARA EL 6 (D. M.)', true),

('030400', '030000', 'MUNICIPIO VILLA JARAGUA', false),
('030401', '030000', 'VILLA JARAGUA (D. M.)', true),

('030500', '030000', 'MUNICIPIO LOS RÍOS', false),
('030501', '030000', 'LOS RÍOS (D. M.)', true),
('030502', '030000', 'LAS CLAVELLINAS (D. M.)', true);

INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES

-- ===== 04 BARAHONA =====
('040100', '040000', 'MUNICIPIO BARAHONA', false),
('040101', '040000', 'BARAHONA (D. M.)', true),
('040102', '040000', 'EL CACHÓN (D. M.)', true),
('040103', '040000', 'LA GUÁZARA (D. M.)', true),
('040104', '040000', 'VILLA CENTRAL (D. M.)', true),

('040200', '040000', 'MUNICIPIO CABRAL', false),
('040201', '040000', 'CABRAL (D. M.)', true),

('040300', '040000', 'MUNICIPIO ENRIQUILLO', false),
('040301', '040000', 'ENRIQUILLO (D. M.)', true),
('040302', '040000', 'ARROYO DULCE (D. M.)', true),

('040400', '040000', 'MUNICIPIO PARAÍSO', false),
('040401', '040000', 'PARAÍSO (D. M.)', true),
('040402', '040000', 'LOS PATOS (D. M.)', true),

('040500', '040000', 'MUNICIPIO VICENTE NOBLE', false),
('040501', '040000', 'VICENTE NOBLE (D. M.)', true),
('040502', '040000', 'CANOA (D. M.)', true),
('040503', '040000', 'QUITA CORAZA (D. M.)', true),
('040504', '040000', 'FONDO NEGRO (D. M.)', true),

('040600', '040000', 'MUNICIPIO EL PEÑÓN', false),
('040601', '040000', 'EL PEÑÓN (D. M.)', true),

('040700', '040000', 'MUNICIPIO LA CIÉNAGA', false),
('040701', '040000', 'LA CIÉNAGA (D. M.)', true),
('040702', '040000', 'BAHORUCO (D. M.)', true),

('040800', '040000', 'MUNICIPIO FUNDACIÓN', false),
('040801', '040000', 'FUNDACIÓN (D. M.)', true),
('040802', '040000', 'PESCADERÍA (D. M.)', true),

('040900', '040000', 'MUNICIPIO LAS SALINAS', false),
('040901', '040000', 'LAS SALINAS (D. M.)', true),

('041000', '040000', 'MUNICIPIO POLO', false),
('041001', '040000', 'POLO (D. M.)', true),

('041100', '040000', 'MUNICIPIO JAQUIMEYES', false),
('041101', '040000', 'JAQUIMEYES (D. M.)', true),
('041102', '040000', 'PALO ALTO (D. M.)', true);


INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES

-- ===== 05 DAJABÓN =====
('050100', '050000', 'MUNICIPIO DAJABÓN', false),
('050101', '050000', 'DAJABÓN (D. M.)', true),
('050102', '050000', 'CAÑONGO (D. M.)', true),

('050200', '050000', 'MUNICIPIO LOMA DE CABRERA', false),
('050201', '050000', 'LOMA DE CABRERA (D. M.)', true),
('050202', '050000', 'CAPOTILLO (D. M.)', true),
('050203', '050000', 'SANTIAGO DE LA CRUZ (D. M.)', true),

('050300', '050000', 'MUNICIPIO PARTIDO', false),
('050301', '050000', 'PARTIDO (D. M.)', true),

('050400', '050000', 'MUNICIPIO RESTAURACIÓN', false),
('050401', '050000', 'RESTAURACIÓN (D. M.)', true),

('050500', '050000', 'MUNICIPIO EL PINO', false),
('050501', '050000', 'EL PINO (D. M.)', true),
('050502', '050000', 'MANUEL BUENO (D. M.)', true);


INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES

-- ===== 06 DUARTE =====
('060100', '060000', 'MUNICIPIO SAN FRANCISCO DE MACORÍS', false),
('060101', '060000', 'SAN FRANCISCO DE MACORÍS (D. M.)', true),
('060102', '060000', 'LA PEÑA (D. M.)', true),
('060103', '060000', 'CENOVÍ (D. M.)', true),
('060104', '060000', 'JAYA (D. M.)', true),
('060105', '060000', 'PRESIDENTE DON ANTONIO GUZMÁN FERNÁNDEZ (D. M.)', true),

('060200', '060000', 'MUNICIPIO ARENOSO', false),
('060201', '060000', 'ARENOSO (D. M.)', true),
('060202', '060000', 'LAS COLES (D. M.)', true),
('060203', '060000', 'EL AGUACATE (D. M.)', true),

('060300', '060000', 'MUNICIPIO CASTILLO', false),
('060301', '060000', 'CASTILLO (D. M.)', true),

('060400', '060000', 'MUNICIPIO PIMENTEL', false),
('060401', '060000', 'PIMENTEL (D. M.)', true),

('060500', '060000', 'MUNICIPIO VILLA RIVA', false),
('060501', '060000', 'VILLA RIVA (D. M.)', true),
('060502', '060000', 'AGUA SANTA DEL YUNA (D. M.)', true),
('060503', '060000', 'CRISTO REY DE GUARAGUAO (D. M.)', true),
('060504', '060000', 'LAS TARANAS (D. M.)', true),
('060505', '060000', 'BARRAQUITO (D. M.)', true),

('060600', '060000', 'MUNICIPIO LAS GUÁRANAS', false),
('060601', '060000', 'LAS GUÁRANAS (D. M.)', true),

('060700', '060000', 'MUNICIPIO EUGENIO MARÍA DE HOSTOS', false),
('060701', '060000', 'EUGENIO MARÍA DE HOSTOS (D. M.)', true),
('060702', '060000', 'SABANA GRANDE (D. M.)', true);

-- ===== 07 ELÍAS PIÑA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('070100', '070000', 'MUNICIPIO COMENDADOR', false),
('070101', '070000', 'COMENDADOR (D. M.)', true),
('070102', '070000', 'SABANA LARGA (D. M.)', true),
('070103', '070000', 'GUAYABO (D. M.)', true),

('070200', '070000', 'MUNICIPIO BÁNICA', false),
('070201', '070000', 'BÁNICA (D. M.)', true),
('070202', '070000', 'SABANA CRUZ (D. M.)', true),
('070203', '070000', 'SABANA HIGÜERO (D. M.)', true),

('070300', '070000', 'MUNICIPIO EL LLANO', false),
('070301', '070000', 'EL LLANO (D. M.)', true),
('070302', '070000', 'GUANITO (D. M.)', true),

('070400', '070000', 'MUNICIPIO HONDO VALLE', false),
('070401', '070000', 'HONDO VALLE (D. M.)', true),
('070402', '070000', 'RANCHO DE LA GUARDIA (D. M.)', true),

('070500', '070000', 'MUNICIPIO PEDRO SANTANA', false),
('070501', '070000', 'PEDRO SANTANA (D. M.)', true),
('070502', '070000', 'RÍO LIMPIO (D. M.)', true),

('070600', '070000', 'MUNICIPIO JUAN SANTIAGO', false),
('070601', '070000', 'JUAN SANTIAGO (D. M.)', true);


-- ===== 08 EL SEIBO =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('080100', '080000', 'MUNICIPIO EL SEIBO', false),
('080101', '080000', 'EL SEIBO (D. M.)', true),
('080102', '080000', 'PEDRO SÁNCHEZ (D. M.)', true),
('080103', '080000', 'SAN FRANCISCO-VICENTILLO (D. M.)', true),
('080104', '080000', 'SANTA LUCÍA (D. M.)', true),

('080200', '080000', 'MUNICIPIO MICHES', false),
('080201', '080000', 'MICHES (D. M.)', true),
('080202', '080000', 'EL CEDRO (D. M.)', true),
('080203', '080000', 'LA GINA (D. M.)', true);


-- ===== 09 ESPAILLAT =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('090100', '090000', 'MUNICIPIO MOCA', false),
('090101', '090000', 'MOCA (D. M.)', true),
('090102', '090000', 'JOSÉ CONTRERAS (D. M.)', true),
('090103', '090000', 'SAN VÍCTOR (D. M.)', true),
('090104', '090000', 'JUAN LÓPEZ (D. M.)', true),
('090105', '090000', 'LAS LAGUNAS (D. M.)', true),
('090106', '090000', 'CANCA LA REYNA (D. M.)', true),
('090107', '090000', 'EL HIGÜERITO (D. M.)', true),
('090108', '090000', 'MONTE DE LA JAGUA (D. M.)', true),
('090109', '090000', 'LA ORTEGA (D. M.)', true),

('090200', '090000', 'MUNICIPIO CAYETANO GERMOSÉN', false),
('090201', '090000', 'CAYETANO GERMOSÉN (D. M.)', true),

('090300', '090000', 'MUNICIPIO GASPAR HERNÁNDEZ', false),
('090301', '090000', 'GASPAR HERNÁNDEZ (D. M.)', true),
('090302', '090000', 'JOBA ARRIBA (D. M.)', true),
('090303', '090000', 'VERAGUA (D. M.)', true),
('090304', '090000', 'VILLA MAGANTE (D. M.)', true),

('090400', '090000', 'MUNICIPIO JAMAO AL NORTE', false),
('090401', '090000', 'JAMAO AL NORTE (D. M.)', true);


-- ===== 10 INDEPENDENCIA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('100100', '100000', 'MUNICIPIO JIMANÍ', false),
('100101', '100000', 'JIMANÍ (D. M.)', true),
('100102', '100000', 'EL LIMÓN (D. M.)', true),
('100103', '100000', 'BOCA DE CACHÓN (D. M.)', true),

('100200', '100000', 'MUNICIPIO DUVERGÉ', false),
('100201', '100000', 'DUVERGÉ (D. M.)', true),
('100202', '100000', 'VENGAN A VER (D. M.)', true),

('100300', '100000', 'MUNICIPIO LA DESCUBIERTA', false),
('100301', '100000', 'LA DESCUBIERTA (D. M.)', true),

('100400', '100000', 'MUNICIPIO POSTRER RÍO', false),
('100401', '100000', 'POSTRER RÍO (D. M.)', true),
('100402', '100000', 'GUAYABAL (D. M.)', true),

('100500', '100000', 'MUNICIPIO CRISTÓBAL', false),
('100501', '100000', 'CRISTÓBAL (D. M.)', true),
('100502', '100000', 'BATEY 8 (D. M.)', true),

('100600', '100000', 'MUNICIPIO MELLA', false),
('100601', '100000', 'MELLA (D. M.)', true),
('100602', '100000', 'LA COLONIA (D. M.)', true);


-- ===== 11 LA ALTAGRACIA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('110100', '110000', 'MUNICIPIO HIGÜEY', false),
('110101', '110000', 'HIGÜEY (D. M.)', true),
('110102', '110000', 'LAS LAGUNAS DE NISIBÓN (D. M.)', true),
('110103', '110000', 'LA OTRA BANDA (D. M.)', true),
('110104', '110000', 'VERÓN PUNTA CANA (D. M.)', true),

('110200', '110000', 'MUNICIPIO SAN RAFAEL DEL YUMA', false),
('110201', '110000', 'SAN RAFAEL DEL YUMA (D. M.)', true),
('110202', '110000', 'BOCA DE YUMA (D. M.)', true),
('110203', '110000', 'BAYAHÍBE (D. M.)', true);


-- ===== 12 LA ROMANA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('120100', '120000', 'MUNICIPIO LA ROMANA', false),
('120101', '120000', 'LA ROMANA (D. M.)', true),
('120102', '120000', 'CALETA (D. M.)', true),

('120200', '120000', 'MUNICIPIO GUAYMATE', false),
('120201', '120000', 'GUAYMATE (D. M.)', true),

('120300', '120000', 'MUNICIPIO VILLA HERMOSA', false),
('120301', '120000', 'VILLA HERMOSA (D. M.)', true),
('120302', '120000', 'CUMAYASA (D. M.)', true);


-- ===== 13 LA VEGA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('130100', '130000', 'MUNICIPIO LA VEGA', false),
('130101', '130000', 'LA VEGA (D. M.)', true),
('130102', '130000', 'RÍO VERDE ARRIBA (D. M.)', true),
('130103', '130000', 'EL RANCHITO (D. M.)', true),
('130104', '130000', 'TAVERAS (D. M.)', true),
('130105', '130000', 'DON JUAN RODRÍGUEZ (D. M.)', true),

('130200', '130000', 'MUNICIPIO CONSTANZA', false),
('130201', '130000', 'CONSTANZA (D. M.)', true),
('130202', '130000', 'TIREO (D. M.)', true),
('130203', '130000', 'LA SABINA (D. M.)', true),

('130300', '130000', 'MUNICIPIO JARABACOA', false),
('130301', '130000', 'JARABACOA (D. M.)', true),
('130302', '130000', 'BUENA VISTA (D. M.)', true),
('130303', '130000', 'MANABAO (D. M.)', true),

('130400', '130000', 'MUNICIPIO JIMA ABAJO', false),
('130401', '130000', 'JIMA ABAJO (D. M.)', true),
('130402', '130000', 'RINCÓN (D. M.)', true);


-- ===== 14 MARÍA TRINIDAD SÁNCHEZ =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('140100', '140000', 'MUNICIPIO NAGUA', false),
('140101', '140000', 'NAGUA (D. M.)', true),
('140102', '140000', 'SAN JOSÉ DE MATANZAS (D. M.)', true),
('140103', '140000', 'LAS GORDAS (D. M.)', true),
('140104', '140000', 'ARROYO AL MEDIO (D. M.)', true),

('140200', '140000', 'MUNICIPIO CABRERA', false),
('140201', '140000', 'CABRERA (D. M.)', true),
('140202', '140000', 'ARROYO SALADO (D. M.)', true),
('140203', '140000', 'LA ENTRADA (D. M.)', true),

('140300', '140000', 'MUNICIPIO EL FACTOR', false),
('140301', '140000', 'EL FACTOR (D. M.)', true),
('140302', '140000', 'EL POZO (D. M.)', true),

('140400', '140000', 'MUNICIPIO RÍO SAN JUAN', false),
('140401', '140000', 'RÍO SAN JUAN (D. M.)', true);


-- ===== 15 MONTE CRISTI =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('150100', '150000', 'MUNICIPIO MONTE CRISTI', false),
('150101', '150000', 'MONTE CRISTI (D. M.)', true),

('150200', '150000', 'MUNICIPIO CASTAÑUELAS', false),
('150201', '150000', 'CASTAÑUELAS (D. M.)', true),
('150202', '150000', 'PALO VERDE (D. M.)', true),

('150300', '150000', 'MUNICIPIO GUAYUBÍN', false),
('150301', '150000', 'GUAYUBÍN (D. M.)', true),
('150302', '150000', 'VILLA ELISA (D. M.)', true),
('150303', '150000', 'HATILLO PALMA (D. M.)', true),
('150304', '150000', 'CANA CHAPETÓN (D. M.)', true),

('150400', '150000', 'MUNICIPIO LAS MATAS DE SANTA CRUZ', false),
('150401', '150000', 'LAS MATAS DE SANTA CRUZ (D. M.)', true),

('150500', '150000', 'MUNICIPIO PEPILLO SALCEDO', false),
('150501', '150000', 'PEPILLO SALCEDO (MANZANILLO) (D. M.)', true),
('150502', '150000', 'SANTA MARÍA (D. M.)', true),

('150600', '150000', 'MUNICIPIO VILLA VÁSQUEZ', false),
('150601', '150000', 'VILLA VÁSQUEZ (D. M.)', true);

SELECT province_dgii_code, COUNT(*)
FROM municipalities
WHERE province_dgii_code IN ('110000','120000','130000','140000','150000')
GROUP BY province_dgii_code
ORDER BY province_dgii_code;


-- ===== 16 PEDERNALES =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('160100', '160000', 'MUNICIPIO PEDERNALES', false),
('160101', '160000', 'PEDERNALES (D. M.)', true),
('160102', '160000', 'JOSÉ FRANCISCO PEÑA GÓMEZ (D. M.)', true),

('160200', '160000', 'MUNICIPIO OVIEDO', false),
('160201', '160000', 'OVIEDO (D. M.)', true),
('160202', '160000', 'JUANCHO (D. M.)', true);


-- ===== 17 PERAVIA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('170100', '170000', 'MUNICIPIO BANÍ', false),
('170101', '170000', 'BANÍ (D. M.)', true),
('170102', '170000', 'MATANZAS (D. M.)', true),
('170103', '170000', 'VILLA FUNDACIÓN (D. M.)', true),
('170104', '170000', 'SABANA BUEY (D. M.)', true),
('170105', '170000', 'PAYA (D. M.)', true),
('170106', '170000', 'VILLA SOMBRERO (D. M.)', true),
('170107', '170000', 'EL CARRETÓN (D. M.)', true),
('170108', '170000', 'CATALINA (D. M.)', true),
('170109', '170000', 'EL LIMONAL (D. M.)', true),
('170110', '170000', 'LAS BARÍAS (D. M.)', true),

('170200', '170000', 'MUNICIPIO NIZAO', false),
('170201', '170000', 'NIZAO (D. M.)', true),
('170202', '170000', 'PIZARRETE (D. M.)', true),
('170203', '170000', 'SANTANA (D. M.)', true);

-- ===== 17 PERAVIA (COMPLEMENTO: MUNICIPIO MATANZAS) =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('170300', '170000', 'MUNICIPIO MATANZAS', false),
('170301', '170000', 'MATANZAS (D. M.)', true);

-- 170300/170301 "MATANZAS" NO insertados: duplicado con 170102, posible errata del PDF.
-- Si confirmas que existe, ejecuta:
-- INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
-- ('170300', '170000', 'MUNICIPIO MATANZAS', false),
-- ('170301', '170000', 'MATANZAS (D. M.)', true);


-- ===== 18 PUERTO PLATA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('180100', '180000', 'MUNICIPIO PUERTO PLATA', false),
('180101', '180000', 'PUERTO PLATA (D. M.)', true),
('180102', '180000', 'YÁSICA ARRIBA (D. M.)', true),
('180103', '180000', 'MAIMÓN (D. M.)', true),

('180200', '180000', 'MUNICIPIO ALTAMIRA', false),
('180201', '180000', 'ALTAMIRA (D. M.)', true),
('180202', '180000', 'RÍO GRANDE (D. M.)', true),

('180300', '180000', 'MUNICIPIO GUANANICO', false),
('180301', '180000', 'GUANANICO (D. M.)', true),

('180400', '180000', 'MUNICIPIO IMBERT', false),
('180401', '180000', 'IMBERT (D. M.)', true),

('180500', '180000', 'MUNICIPIO LOS HIDALGOS', false),
('180501', '180000', 'LOS HIDALGOS (D. M.)', true),
('180502', '180000', 'NAVAS (D. M.)', true),

('180600', '180000', 'MUNICIPIO LUPERÓN', false),
('180601', '180000', 'LUPERÓN (D. M.)', true),
('180602', '180000', 'LA ISABELA (D. M.)', true),
('180603', '180000', 'BELLOSO (D. M.)', true),
('180604', '180000', 'EL ESTRECHO DE LUPERÓN OMAR BROSS (D. M.)', true),

('180700', '180000', 'MUNICIPIO SOSÚA', false),
('180701', '180000', 'SOSÚA (D. M.)', true),
('180702', '180000', 'CABARETE (D. M.)', true),
('180703', '180000', 'SABANETA DE YÁSICA (D. M.)', true),

('180800', '180000', 'MUNICIPIO VILLA ISABELA', false),
('180801', '180000', 'VILLA ISABELA (D. M.)', true),
('180802', '180000', 'ESTERO HONDO (D. M.)', true),
('180803', '180000', 'LA JAIBA (D. M.)', true),
('180804', '180000', 'GUALETE (D. M.)', true),

('180900', '180000', 'MUNICIPIO VILLA MONTELLANO', false),
('180901', '180000', 'VILLA MONTELLANO (D. M.)', true);


-- ===== 19 HERMANAS MIRABAL =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('190100', '190000', 'MUNICIPIO SALCEDO', false),
('190101', '190000', 'SALCEDO (D. M.)', true),
('190102', '190000', 'JAMAO AFUERA (D. M.)', true),

('190200', '190000', 'MUNICIPIO TENARES', false),
('190201', '190000', 'TENARES (D. M.)', true),
('190202', '190000', 'BLANCO (D. M.)', true),

('190300', '190000', 'MUNICIPIO VILLA TAPIA', false),
('190301', '190000', 'VILLA TAPIA (D. M.)', true);

-- ===== 20 SAMANÁ =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('200100', '200000', 'MUNICIPIO SAMANÁ', false),
('200101', '200000', 'SAMANÁ (D. M.)', true),
('200102', '200000', 'EL LIMÓN (D. M.)', true),
('200103', '200000', 'ARROYO BARRIL (D. M.)', true),
('200104', '200000', 'LAS GALERAS (D. M.)', true),

('200200', '200000', 'MUNICIPIO SÁNCHEZ', false),
('200201', '200000', 'SÁNCHEZ (D. M.)', true),

('200300', '200000', 'MUNICIPIO LAS TERRENAS', false),
('200301', '200000', 'LAS TERRENAS (D. M.)', true);



SELECT province_dgii_code, COUNT(*)
FROM municipalities
WHERE province_dgii_code IN ('160000','170000','180000','190000','200000')
GROUP BY province_dgii_code
ORDER BY province_dgii_code;


-- ===== 21 SAN CRISTÓBAL =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('210100', '210000', 'MUNICIPIO SAN CRISTÓBAL', false),
('210101', '210000', 'SAN CRISTÓBAL (D. M.)', true),
('210102', '210000', 'HATO DAMAS (D. M.)', true),
('210103', '210000', 'HATILLO (D. M.)', true),

('210200', '210000', 'MUNICIPIO SABANA GRANDE DE PALENQUE', false),
('210201', '210000', 'SABANA GRANDE DE PALENQUE (D. M.)', true),

('210300', '210000', 'MUNICIPIO BAJOS DE HAINA', false),
('210301', '210000', 'BAJOS DE HAINA (D. M.)', true),
('210302', '210000', 'EL CARRIL (D. M.)', true),
('210303', '210000', 'QUITA SUEÑO (D. M.)', true),

('210400', '210000', 'MUNICIPIO CAMBITA GARABITOS', false),
('210401', '210000', 'CAMBITA GARABITOS (D. M.)', true),
('210402', '210000', 'CAMBITA EL PUEBLECITO (D. M.)', true),

('210500', '210000', 'MUNICIPIO VILLA ALTAGRACIA', false),
('210501', '210000', 'VILLA ALTAGRACIA (D. M.)', true),
('210502', '210000', 'SAN JOSÉ DEL PUERTO (D. M.)', true),
('210503', '210000', 'MEDINA (D. M.)', true),
('210504', '210000', 'LA CUCHILLA (D. M.)', true),

('210600', '210000', 'MUNICIPIO YAGUATE', false),
('210601', '210000', 'YAGUATE (D. M.)', true),
('210602', '210000', 'DOÑA ANA (D. M.)', true),

('210700', '210000', 'MUNICIPIO SAN GREGORIO DE NIGUA', false),
('210701', '210000', 'SAN GREGORIO DE NIGUA (D. M.)', true),

('210800', '210000', 'MUNICIPIO LOS CACAOS', false),
('210801', '210000', 'LOS CACAOS (D. M.)', true);


-- ===== 22 SAN JUAN =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('220100', '220000', 'MUNICIPIO SAN JUAN', false),
('220101', '220000', 'SAN JUAN (D. M.)', true),
('220102', '220000', 'PEDRO CORTO (D. M.)', true),
('220103', '220000', 'SABANETA (D. M.)', true),
('220104', '220000', 'SABANA ALTA (D. M.)', true),
('220105', '220000', 'EL ROSARIO (D. M.)', true),
('220106', '220000', 'HATO DEL PADRE (D. M.)', true),
('220107', '220000', 'GUANITO (D. M.)', true),
('220108', '220000', 'LA JAGUA (D. M.)', true),
('220109', '220000', 'LAS MAGUANAS-HATO NUEVO (D. M.)', true),
('220110', '220000', 'LAS CHARCAS DE MARÍA NOVA (D. M.)', true),
('220111', '220000', 'LAS ZANJAS (D. M.)', true),

('220200', '220000', 'MUNICIPIO BOHECHÍO', false),
('220201', '220000', 'BOHECHÍO (D. M.)', true),
('220202', '220000', 'ARROYO CANO (D. M.)', true),
('220203', '220000', 'YAQUE (D. M.)', true),

('220300', '220000', 'MUNICIPIO EL CERCADO', false),
('220301', '220000', 'EL CERCADO (D. M.)', true),
('220302', '220000', 'DERRUMBADERO (D. M.)', true),
('220303', '220000', 'BATISTA (D. M.)', true),

('220400', '220000', 'MUNICIPIO JUAN DE HERRERA', false),
('220401', '220000', 'JUAN DE HERRERA (D. M.)', true),
('220402', '220000', 'JÍNOVA (D. M.)', true),

('220500', '220000', 'MUNICIPIO LAS MATAS DE FARFÁN', false),
('220501', '220000', 'LAS MATAS DE FARFÁN (D. M.)', true),
('220502', '220000', 'MATAYAYA (D. M.)', true),
('220503', '220000', 'CARRERA DE YEGUAS (D. M.)', true),

('220600', '220000', 'MUNICIPIO VALLEJUELO', false),
('220601', '220000', 'VALLEJUELO (D. M.)', true),
('220602', '220000', 'JORJILLO (D. M.)', true);


-- ===== 23 SAN PEDRO DE MACORÍS =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('230100', '230000', 'MUNICIPIO SAN PEDRO DE MACORÍS', false),
('230101', '230000', 'SAN PEDRO DE MACORÍS (D. M.)', true),

('230200', '230000', 'MUNICIPIO LOS LLANOS', false),
('230201', '230000', 'LOS LLANOS (D. M.)', true),
('230202', '230000', 'EL PUERTO (D. M.)', true),
('230203', '230000', 'GAUTIER (D. M.)', true),

('230300', '230000', 'MUNICIPIO RAMÓN SANTANA', false),
('230301', '230000', 'RAMÓN SANTANA (D. M.)', true),

('230400', '230000', 'MUNICIPIO CONSUELO', false),
('230401', '230000', 'CONSUELO (D. M.)', true),

('230500', '230000', 'MUNICIPIO QUISQUEYA', false),
('230501', '230000', 'QUISQUEYA (D. M.)', true),

('230600', '230000', 'MUNICIPIO GUAYACANES', false),
('230601', '230000', 'GUAYACANES (D. M.)', true);


-- ===== 24 SÁNCHEZ RAMÍREZ =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('240100', '240000', 'MUNICIPIO COTUÍ', false),
('240101', '240000', 'COTUÍ (D. M.)', true),
('240102', '240000', 'QUITA SUEÑO (D. M.)', true),
('240103', '240000', 'CABALLERO (D. M.)', true),
('240104', '240000', 'COMEDERO ARRIBA (D. M.)', true),
('240105', '240000', 'PLATANAL (D. M.)', true),
('240106', '240000', 'ZAMBRANA ABAJO (D. M.)', true),

('240200', '240000', 'MUNICIPIO CEVICOS', false),
('240201', '240000', 'CEVICOS (D. M.)', true),
('240202', '240000', 'LA CUEVA (D. M.)', true),

('240300', '240000', 'MUNICIPIO FANTINO', false),
('240301', '240000', 'FANTINO (D. M.)', true),

('240400', '240000', 'MUNICIPIO LA MATA', false),
('240401', '240000', 'LA MATA (D. M.)', true),
('240402', '240000', 'LA BIJA (D. M.)', true),
('240403', '240000', 'ANGELINA (D. M.)', true),
('240404', '240000', 'HERNANDO ALONZO (D. M.)', true);


-- ===== 25 SANTIAGO =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('250100', '250000', 'MUNICIPIO SANTIAGO', false),
('250101', '250000', 'SANTIAGO (D. M.)', true),
('250102', '250000', 'PEDRO GARCÍA (D. M.)', true),
-- 250103: NO EXISTE en el PDF (hueco respetado)
('250104', '250000', 'BAITOA (D. M.)', true),
('250105', '250000', 'LA CANELA (D. M.)', true),
('250106', '250000', 'SAN FRANCISCO DE JACAGUA (D. M.)', true),
('250107', '250000', 'HATO DEL YAQUE (D. M.)', true),

('250200', '250000', 'MUNICIPIO BISONÓ', false),
('250201', '250000', 'VILLA BISONÓ (NAVARRETE) (D. M.)', true),

('250300', '250000', 'MUNICIPIO JÁNICO', false),
('250301', '250000', 'JÁNICO (D. M.)', true),
('250302', '250000', 'JUNCALITO (D. M.)', true),
('250303', '250000', 'EL CAIMITO (D. M.)', true),

('250400', '250000', 'MUNICIPIO LICEY AL MEDIO', false),
('250401', '250000', 'LICEY AL MEDIO (D. M.)', true),
('250402', '250000', 'LAS PALOMAS (D. M.)', true),

('250500', '250000', 'MUNICIPIO SAN JOSÉ DE LAS MATAS', false),
('250501', '250000', 'SAN JOSÉ DE LAS MATAS (D. M.)', true),
('250502', '250000', 'EL RUBIO (D. M.)', true),
('250503', '250000', 'LA CUESTA (D. M.)', true),
('250504', '250000', 'LAS PLACETAS (D. M.)', true),

('250600', '250000', 'MUNICIPIO TAMBORIL', false),
('250601', '250000', 'TAMBORIL (D. M.)', true),
('250602', '250000', 'CANCA LA PIEDRA (D. M.)', true),

('250700', '250000', 'MUNICIPIO VILLA GONZÁLEZ', false),
('250701', '250000', 'VILLA GONZÁLEZ (D. M.)', true),
('250702', '250000', 'PALMAR ARRIBA (D. M.)', true),
('250703', '250000', 'EL LIMÓN (D. M.)', true),

('250800', '250000', 'MUNICIPIO PUÑAL', false),
('250801', '250000', 'PUÑAL (D. M.)', true),
('250802', '250000', 'GUAYABAL (D. M.)', true),
('250803', '250000', 'CANABACOA (D. M.)', true),

('250900', '250000', 'MUNICIPIO SABANA IGLESIA', false),
('250901', '250000', 'SABANA IGLESIA (D. M.)', true),

('251000', '250000', 'MUNICIPIO BAITOA', false),
('251001', '250000', 'BAITOA (D. M.)', true);

SELECT province_dgii_code, COUNT(*)
FROM municipalities
WHERE province_dgii_code IN ('210000','220000','230000','240000','250000')
GROUP BY province_dgii_code
ORDER BY province_dgii_code;


-- ===== 26 SANTIAGO RODRÍGUEZ =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('260100', '260000', 'MUNICIPIO SAN IGNACIO DE SABANETA', false),
('260101', '260000', 'SAN IGNACIO DE SABANETA (D. M.)', true),

('260200', '260000', 'MUNICIPIO VILLA LOS ALMÁCIGOS', false),
('260201', '260000', 'VILLA LOS ALMÁCIGOS (D. M.)', true),

('260300', '260000', 'MUNICIPIO MONCIÓN', false),
('260301', '260000', 'MONCIÓN (D. M.)', true);


-- ===== 27 VALVERDE =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('270100', '270000', 'MUNICIPIO MAO', false),
('270101', '270000', 'MAO (D. M.)', true),
('270102', '270000', 'AMINA (D. M.)', true),
('270103', '270000', 'JAIBÓN (PUEBLO NUEVO) (D. M.)', true),
('270104', '270000', 'GUATAPANAL (D. M.)', true),

('270200', '270000', 'MUNICIPIO ESPERANZA', false),
('270201', '270000', 'ESPERANZA (D. M.)', true),
('270202', '270000', 'MAIZAL (D. M.)', true),
('270203', '270000', 'JICOMÉ (D. M.)', true),
('270204', '270000', 'BOCA DE MAO (D. M.)', true),
('270205', '270000', 'PARADERO (D. M.)', true),

('270300', '270000', 'MUNICIPIO LAGUNA SALADA', false),
('270301', '270000', 'LAGUNA SALADA (D. M.)', true),
('270302', '270000', 'JAIBÓN (D. M.)', true),
('270303', '270000', 'LA CAYA (D. M.)', true),
('270304', '270000', 'CRUCE DE GUAYACANES (D. M.)', true);


-- ===== 28 MONSEÑOR NOUEL =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('280100', '280000', 'MUNICIPIO BONAO', false),
('280101', '280000', 'BONAO (D. M.)', true),
('280102', '280000', 'SABANA DEL PUERTO (D. M.)', true),
('280103', '280000', 'JUMA BEJUCAL (D. M.)', true),
('280104', '280000', 'ARROYO TORO - MASIPEDRO (D. M.)', true),
('280105', '280000', 'JAYACO (D. M.)', true),
('280106', '280000', 'LA SALVIA - LOS QUEMADOS (D. M.)', true),

('280200', '280000', 'MUNICIPIO MAIMÓN', false),
('280201', '280000', 'MAIMÓN (D. M.)', true),

('280300', '280000', 'MUNICIPIO PIEDRA BLANCA', false),
('280301', '280000', 'PIEDRA BLANCA (D. M.)', true),
('280302', '280000', 'VILLA DE SONADOR (D. M.)', true),
('280303', '280000', 'JUAN ADRIÁN (D. M.)', true);


-- ===== 29 MONTE PLATA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('290100', '290000', 'MUNICIPIO MONTE PLATA', false),
('290101', '290000', 'MONTE PLATA (D. M.)', true),
('290102', '290000', 'DON JUAN (D. M.)', true),
('290103', '290000', 'CHIRINO (D. M.)', true),
('290104', '290000', 'BOYÁ (D. M.)', true),

('290200', '290000', 'MUNICIPIO BAYAGUANA', false),
('290201', '290000', 'BAYAGUANA (D. M.)', true),

('290300', '290000', 'MUNICIPIO SABANA GRANDE DE BOYÁ', false),
('290301', '290000', 'SABANA GRANDE DE BOYÁ (D. M.)', true),
('290302', '290000', 'GONZALO (D. M.)', true),
('290303', '290000', 'MAJAGUAL (D. M.)', true),

('290400', '290000', 'MUNICIPIO YAMASÁ', false),
-- 290401: NO EXISTE en el PDF (hueco respetado)
('290402', '290000', 'LOS BOTADOS (D. M.)', true),
('290403', '290000', 'MAMÁ TINGÓ (D. M.)', true),

('290500', '290000', 'MUNICIPIO PERALVILLO', false),
('290501', '290000', 'PERALVILLO (D. M.)', true);


-- ===== 30 HATO MAYOR =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('300100', '300000', 'MUNICIPIO HATO MAYOR', false),
('300101', '300000', 'HATO MAYOR (D. M.)', true),
('300102', '300000', 'YERBA BUENA (D. M.)', true),
('300103', '300000', 'MATA PALACIO (D. M.)', true),
('300104', '300000', 'GUAYABO DULCE (D. M.)', true),

('300200', '300000', 'MUNICIPIO SABANA DE LA MAR', false),
('300201', '300000', 'SABANA DE LA MAR (D. M.)', true),
('300202', '300000', 'ELUPINA CORDERO DE LAS CAÑITAS (D. M.)', true),

('300300', '300000', 'MUNICIPIO EL VALLE', false),
('300301', '300000', 'EL VALLE (D. M.)', true);



-- ===== 31 SAN JOSÉ DE OCOA =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('310100', '310000', 'MUNICIPIO SAN JOSÉ DE OCOA', false),
('310101', '310000', 'SAN JOSÉ DE OCOA (D. M.)', true),
('310102', '310000', 'LA CIÉNAGA (D. M.)', true),
('310103', '310000', 'NIZAO - LAS AUYAMAS (D. M.)', true),
('310104', '310000', 'EL PINAR (D. M.)', true),
('310105', '310000', 'EL NARANJAL (D. M.)', true),

('310200', '310000', 'MUNICIPIO SABANA LARGA', false),
('310201', '310000', 'SABANA LARGA (D. M.)', true),

('310300', '310000', 'MUNICIPIO RANCHO ARRIBA', false),
('310301', '310000', 'RANCHO ARRIBA (D. M.)', true);


-- ===== 32 SANTO DOMINGO =====
INSERT INTO municipalities (dgii_code, province_dgii_code, name, is_district) VALUES
('320100', '320000', 'MUNICIPIO SANTO DOMINGO ESTE', false),
('320101', '320000', 'SANTO DOMINGO ESTE (D. M.)', true),
('320102', '320000', 'SAN LUIS (D. M.)', true),

('320200', '320000', 'MUNICIPIO SANTO DOMINGO OESTE', false),
('320201', '320000', 'SANTO DOMINGO OESTE (D. M.)', true),

('320300', '320000', 'MUNICIPIO SANTO DOMINGO NORTE', false),
('320301', '320000', 'SANTO DOMINGO NORTE (D. M.)', true),
('320302', '320000', 'LA VICTORIA (D. M.)', true),

('320400', '320000', 'MUNICIPIO BOCA CHICA', false),
('320401', '320000', 'BOCA CHICA (D. M.)', true),
('320402', '320000', 'LA CALETA (D. M.)', true),

('320500', '320000', 'MUNICIPIO SAN ANTONIO DE GUERRA', false),
('320501', '320000', 'SAN ANTONIO DE GUERRA (D. M.)', true),
('320502', '320000', 'HATO VIEJO (D. M.)', true),

('320600', '320000', 'MUNICIPIO LOS ALCARRIZOS', false),
('320601', '320000', 'LOS ALCARRIZOS (D. M.)', true),
('320602', '320000', 'PALMAREJO-VILLA LINDA (D. M.)', true),
('320603', '320000', 'PANTOJA (D. M.)', true),

('320700', '320000', 'MUNICIPIO PEDRO BRAND', false),
('320701', '320000', 'PEDRO BRAND (D. M.)', true),
('320702', '320000', 'LA GUÁYIGA (D. M.)', true),
('320703', '320000', 'LA CUABA (D. M.)', true);