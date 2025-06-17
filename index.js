const { FastDB } = require('./build/Release/fastdb');

/**
 * @typedef {object} SnapshotOptions
 * @property {boolean} [enabled=false] Whether the snapshots are enabled
 * @property {number} [interval=86400000] The interval between each snapshot
 * @property {string} [path='./backups/'] The path of the backups
 */

/**
 * @typedef {object} DatabaseOptions
 * @property {SnapshotOptions} [snapshots] Snapshot configuration options
 * @property {boolean} [autoSync=true] Whether to automatically sync changes to disk
 * @property {number} [maxFileSize=100000000] Maximum file size in bytes (100MB default)
 */

/**
 * @typedef {object} DatabaseStats
 * @property {number} totalKeys Total number of keys in the database
 * @property {number} regularProperties Number of non-nested properties
 * @property {number} nestedProperties Number of nested properties (dot notation)
 * @property {number} totalSize Total size of all data in bytes
 * @property {number} averageKeySize Average size of key-value pairs
 * @property {string} filename Database filename
 */

/**
 * @typedef {object} KeyValuePair
 * @property {string} key The key name
 * @property {any} value The value associated with the key
 */

/**
 * FastDB - Ultra-fast native database for Node.js
 * High-performance C++ key-value store with dot notation support
 */
class Database extends FastDB {
    /**
     * Creates a new Database instance
     * @param {string} [filename='fastdb.bin'] The path of the database file
     * @param {DatabaseOptions} [options={}] Database configuration options
     */
    constructor(filename = 'fastdb.bin', options = {}) {
        super(filename);
        this.filename = filename;
        this.options = {
            autoSync: options.autoSync !== false,
            maxFileSize: options.maxFileSize || 100000000,
            snapshots: {
                enabled: options.snapshots?.enabled || false,
                interval: options.snapshots?.interval || 86400000,
                path: options.snapshots?.path || './backups/'
            }
        };
        
        if (this.options.snapshots.enabled) {
            this._initSnapshots();
        }
    }

    /**
     * Sets a key-value pair in the database
     * @param {string} key The key to set (supports dot notation for nested data)
     * @param {any} value The value to store
     * @returns {Database} Returns the database instance for chaining
     * @throws {TypeError} If key is not a string
     * @throws {RangeError} If key is empty or longer than 1000 characters
     */
    set(key, value) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }
        if (key.length === 0 || key.length > 1000) {
            throw new RangeError('Key must be 1-1000 characters');
        }

        return super.set(key, value);
    }

    /**
     * Gets a value from the database by key
     * @param {string} key The key to retrieve (supports dot notation)
     * @param {any} [defaultValue=null] Default value if key doesn't exist
     * @returns {any} The value associated with the key, or defaultValue
     * @throws {TypeError} If key is not a string
     */
    get(key, defaultValue = null) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }

        const result = super.get(key);
        return result !== null ? result : defaultValue;
    }

    /**
     * Deletes a key-value pair from the database
     * @param {string} key The key to delete (supports dot notation)
     * @returns {boolean} True if the key was deleted, false if it didn't exist
     * @throws {TypeError} If key is not a string
     */
    delete(key) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }

        return super.delete(key);
    }

    /**
     * Checks if a key exists in the database
     * @param {string} key The key to check (supports dot notation)
     * @returns {boolean} True if the key exists, false otherwise
     * @throws {TypeError} If key is not a string
     */
    has(key) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }

        return super.has(key);
    }

    /**
     * Returns all key-value pairs in the database
     * @returns {KeyValuePair[]} Array of all key-value pairs
     */
    all() {
        const keys = this.keys();
        const values = this.values();
        const result = [];
        
        // Handle nested data
        let hasNestedData = false;
        let nestedData = {};
        
        for (let i = 0; i < keys.length; i++) {
            if (keys[i] === '__root__') {
                hasNestedData = true;
                try {
                    nestedData = JSON.parse(values[i]);
                } catch {
                    nestedData = {};
                }
            } else {
                result.push({ key: keys[i], value: values[i] });
            }
        }
        
        // Add nested properties to result
        if (hasNestedData) {
            const addNestedToResult = (obj, prefix = '') => {
                for (const [key, value] of Object.entries(obj)) {
                    const fullKey = prefix ? `${prefix}.${key}` : key;
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        addNestedToResult(value, fullKey);
                    } else {
                        result.push({ key: fullKey, value });
                    }
                }
            };
            addNestedToResult(nestedData);
        }
        
        return result;
    }

    /**
     * Clears all data from the database
     * @returns {Database} Returns the database instance for chaining
     */
    clear() {
        return super.clear();
    }

    /**
     * Adds an element to an array. Creates the array if it doesn't exist.
     * @param {string} key The key of the array (supports dot notation)
     * @param {any} element The element to add to the array
     * @returns {number} The new length of the array
     * @throws {TypeError} If key is not a string
     */
    push(key, element) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }
        
        let arr = this.get(key, '[]');
        if (typeof arr === 'string') {
            try {
                arr = JSON.parse(arr);
            } catch {
                arr = [];
            }
        }
        
        if (!Array.isArray(arr)) {
            arr = [];
        }
        
        arr.push(element);
        this.set(key, JSON.stringify(arr));
        return arr.length;
    }

    /**
     * Removes all instances of an element from an array
     * @param {string} key The key of the array (supports dot notation)
     * @param {any} element The element to remove from the array
     * @returns {number} The number of elements removed
     * @throws {TypeError} If key is not a string
     */
    pull(key, element) {
        if (typeof key !== 'string') {
            throw new TypeError('Key must be a string');
        }
        
        let arr = this.get(key, '[]');
        if (typeof arr === 'string') {
            try {
                arr = JSON.parse(arr);
            } catch {
                return 0;
            }
        }
        
        if (!Array.isArray(arr)) {
            return 0;
        }
        
        const filtered = arr.filter(item => item !== element);
        this.set(key, JSON.stringify(filtered));
        return arr.length - filtered.length;
    }

    /**
     * Adds to a numeric value. Creates the key with value 0 if it doesn't exist.
     * @param {string} key The key of the numeric value (supports dot notation)
     * @param {number} [amount=1] The amount to add
     * @returns {number} The new numeric value
     */
    add(key, amount = 1) {
        const currentValue = parseFloat(this.get(key, '0')) || 0;
        const newValue = currentValue + amount;
        this.set(key, newValue.toString());
        return newValue;
    }

    /**
     * Subtracts from a numeric value. Creates the key with value 0 if it doesn't exist.
     * @param {string} key The key of the numeric value (supports dot notation)
     * @param {number} [amount=1] The amount to subtract
     * @returns {number} The new numeric value
     */
    subtract(key, amount = 1) {
        return this.add(key, -amount);
    }

    /**
     * Multiplies a numeric value. Creates the key with value 1 if it doesn't exist.
     * @param {string} key The key of the numeric value (supports dot notation)
     * @param {number} [amount=1] The amount to multiply by
     * @returns {number} The new numeric value
     */
    multiply(key, amount = 1) {
        const currentValue = parseFloat(this.get(key, '1')) || 1;
        const newValue = currentValue * amount;
        this.set(key, newValue.toString());
        return newValue;
    }

    /**
     * Divides a numeric value. Creates the key with value 1 if it doesn't exist.
     * @param {string} key The key of the numeric value (supports dot notation)
     * @param {number} [amount=1] The amount to divide by
     * @returns {number} The new numeric value
     * @throws {Error} If dividing by zero
     */
    divide(key, amount = 1) {
        if (amount === 0) throw new Error('Cannot divide by zero');
        return this.multiply(key, 1 / amount);
    }

    /**
     * Manually saves changes to disk. Auto-saves on process exit.
     * @returns {boolean} True if save was successful
     */
    sync() {
        return this.save();
    }

    /**
     * Creates a backup of the database to a JSON file with metadata
     * @param {string} filename The backup filename
     * @returns {boolean} True if backup was successful
     * @throws {Error} If backup filename is not provided or backup fails
     */
    backup(filename) {
        if (!filename) {
            throw new Error('Backup filename is required');
        }
        
        try {
            const fs = require('fs');
            const path = require('path');
            
            const backupData = {
                timestamp: new Date().toISOString(),
                data: this.export(),
                version: require('./package.json').version
            };
            
            fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
            return true;
        } catch (error) {
            throw new Error('Backup failed: ' + error.message);
        }
    }

    /**
     * Returns all data as a plain JavaScript object
     * @returns {Object.<string, any>} All database data as key-value pairs
     */
    export() {
        const all = this.all();
        const result = {};
        
        for (const item of all) {
            result[item.key] = item.value;
        }
        
        return result;
    }

    /**
     * Imports data from a JavaScript object. Supports nested objects.
     * @param {Object.<string, any>} data The data to import
     * @returns {boolean} True if import was successful
     * @throws {TypeError} If data is not an object
     */
    import(data) {
        if (typeof data !== 'object' || data === null) {
            throw new TypeError('Import data must be an object');
        }
        
        const flattenObject = (obj, prefix = '') => {
            const flattened = {};
            for (const [key, value] of Object.entries(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    Object.assign(flattened, flattenObject(value, fullKey));
                } else {
                    flattened[fullKey] = value;
                }
            }
            return flattened;
        };
        
        const flattened = flattenObject(data);
        for (const [key, value] of Object.entries(flattened)) {
            this.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        }
        
        return true;
    }

    /**
     * Returns detailed database statistics and information
     * @returns {DatabaseStats} Database statistics object
     */
    stats() {
        const all = this.all();
        let totalSize = 0;
        let nestedProperties = 0;
        let regularProperties = 0;
        
        for (const item of all) {
            totalSize += item.key.length + (typeof item.value === 'string' ? item.value.length : JSON.stringify(item.value).length);
            
            if (item.key.includes('.')) {
                nestedProperties++;
            } else {
                regularProperties++;
            }
        }
        
        return {
            totalKeys: all.length,
            regularProperties,
            nestedProperties,
            totalSize,
            averageKeySize: all.length > 0 ? Math.round(totalSize / all.length) : 0,
            filename: this.filename
        };
    }

    /**
     * Initialize snapshot functionality (internal method)
     * @private
     */
    _initSnapshots() {
        if (!this.options.snapshots.enabled) return;

        const fs = require('fs');
        const path = require('path');
        
        // Ensure backup directory exists
        const backupPath = this.options.snapshots.path;
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }

        // Set up automatic snapshots
        this._snapshotInterval = setInterval(() => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = path.join(backupPath, `snapshot-${timestamp}.json`);
            try {
                this.backup(filename);
            } catch (error) {
                console.error('Snapshot failed:', error.message);
            }
        }, this.options.snapshots.interval);
    }
}

module.exports = Database; 