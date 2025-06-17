/**
 * FastDB - Ultra-fast native database for Node.js
 * High-performance C++ key-value store with dot notation support
 */

export interface SnapshotOptions {
  /** Whether the snapshots are enabled */
  enabled?: boolean;
  /** The interval between each snapshot in milliseconds */
  interval?: number;
  /** The path of the backups */
  path?: string;
}

export interface DatabaseOptions {
  /** Snapshot configuration options */
  snapshots?: SnapshotOptions;
  /** Whether to automatically sync changes to disk */
  autoSync?: boolean;
  /** Maximum file size in bytes (100MB default) */
  maxFileSize?: number;
}

export interface DatabaseStats {
  /** Total number of keys in the database */
  totalKeys: number;
  /** Number of non-nested properties */
  regularProperties: number;
  /** Number of nested properties (dot notation) */
  nestedProperties: number;
  /** Total size of all data in bytes */
  totalSize: number;
  /** Average size of key-value pairs */
  averageKeySize: number;
  /** Database filename */
  filename: string;
}

export interface KeyValuePair {
  /** The key name */
  key: string;
  /** The value associated with the key */
  value: any;
}

/**
 * FastDB - Ultra-fast native database for Node.js
 * High-performance C++ key-value store with dot notation support
 */
export default class Database {
  /** Database filename */
  readonly filename: string;
  
  /** Database configuration options */
  readonly options: Required<DatabaseOptions>;

  /**
   * Creates a new Database instance
   * @param filename The path of the database file
   * @param options Database configuration options
   */
  constructor(filename?: string, options?: DatabaseOptions);

  /**
   * Sets a key-value pair in the database
   * @param key The key to set (supports dot notation for nested data)
   * @param value The value to store
   * @returns Returns the database instance for chaining
   * @throws {TypeError} If key is not a string
   * @throws {RangeError} If key is empty or longer than 1000 characters
   */
  set(key: string, value: any): this;

  /**
   * Gets a value from the database by key
   * @param key The key to retrieve (supports dot notation)
   * @param defaultValue Default value if key doesn't exist
   * @returns The value associated with the key, or defaultValue
   * @throws {TypeError} If key is not a string
   */
  get(key: string, defaultValue?: any): any;

  /**
   * Deletes a key-value pair from the database
   * @param key The key to delete (supports dot notation)
   * @returns True if the key was deleted, false if it didn't exist
   * @throws {TypeError} If key is not a string
   */
  delete(key: string): boolean;

  /**
   * Checks if a key exists in the database
   * @param key The key to check (supports dot notation)
   * @returns True if the key exists, false otherwise
   * @throws {TypeError} If key is not a string
   */
  has(key: string): boolean;

  /**
   * Returns all key-value pairs in the database
   * @returns Array of all key-value pairs
   */
  all(): KeyValuePair[];

  /**
   * Clears all data from the database
   * @returns Returns the database instance for chaining
   */
  clear(): this;

  /**
   * Adds an element to an array. Creates the array if it doesn't exist.
   * @param key The key of the array (supports dot notation)
   * @param element The element to add to the array
   * @returns The new length of the array
   * @throws {TypeError} If key is not a string
   */
  push(key: string, element: any): number;

  /**
   * Removes all instances of an element from an array
   * @param key The key of the array (supports dot notation)
   * @param element The element to remove from the array
   * @returns The number of elements removed
   * @throws {TypeError} If key is not a string
   */
  pull(key: string, element: any): number;

  /**
   * Adds to a numeric value. Creates the key with value 0 if it doesn't exist.
   * @param key The key of the numeric value (supports dot notation)
   * @param amount The amount to add
   * @returns The new numeric value
   */
  add(key: string, amount?: number): number;

  /**
   * Subtracts from a numeric value. Creates the key with value 0 if it doesn't exist.
   * @param key The key of the numeric value (supports dot notation)
   * @param amount The amount to subtract
   * @returns The new numeric value
   */
  subtract(key: string, amount?: number): number;

  /**
   * Multiplies a numeric value. Creates the key with value 1 if it doesn't exist.
   * @param key The key of the numeric value (supports dot notation)
   * @param amount The amount to multiply by
   * @returns The new numeric value
   */
  multiply(key: string, amount?: number): number;

  /**
   * Divides a numeric value. Creates the key with value 1 if it doesn't exist.
   * @param key The key of the numeric value (supports dot notation)
   * @param amount The amount to divide by
   * @returns The new numeric value
   * @throws {Error} If dividing by zero
   */
  divide(key: string, amount?: number): number;

  /**
   * Manually saves changes to disk. Auto-saves on process exit.
   * @returns True if save was successful
   */
  sync(): boolean;

  /**
   * Creates a backup of the database to a JSON file with metadata
   * @param filename The backup filename
   * @returns True if backup was successful
   * @throws {Error} If backup filename is not provided or backup fails
   */
  backup(filename: string): boolean;

  /**
   * Returns all data as a plain JavaScript object
   * @returns All database data as key-value pairs
   */
  export(): Record<string, any>;

  /**
   * Imports data from a JavaScript object. Supports nested objects.
   * @param data The data to import
   * @returns True if import was successful
   * @throws {TypeError} If data is not an object
   */
  import(data: Record<string, any>): boolean;

  /**
   * Returns detailed database statistics and information
   * @returns Database statistics object
   */
  stats(): DatabaseStats;
}

/**
 * FastDB Database class
 */
export { Database }; 