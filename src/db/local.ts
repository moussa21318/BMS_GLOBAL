import Dexie, { type EntityTable } from 'dexie'
import type {
  Car, CarImage, CarFees, CarStageLog, Customer,
  EditRequest, ChangeLog, Notification, User,
} from '../types'

export interface SyncQueueEntry {
  id: string
  change_log_id: string
  table_name: string
  record_id: string
  operation: 'insert' | 'update' | 'delete'
  synced: boolean
  created_at: string
}

export class LocalDB extends Dexie {
  users!: EntityTable<User, 'id'>
  cars!: EntityTable<Car, 'id'>
  carImages!: EntityTable<CarImage, 'id'>
  carFees!: EntityTable<CarFees, 'id'>
  carStages!: EntityTable<CarStageLog, 'id'>
  customers!: EntityTable<Customer, 'id'>
  editRequests!: EntityTable<EditRequest, 'id'>
  changeLog!: EntityTable<ChangeLog, 'id'>
  notifications!: EntityTable<Notification, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>

  constructor() {
    super('BMSGlobalDB')
    this.version(1).stores({
      users: 'id, username, role, is_active',
      cars: 'id, created_by, current_stage, confirmed, has_pending_edit, updated_at',
      carImages: 'id, car_id',
      carFees: 'id, car_id',
      carStages: 'id, car_id, stage',
      customers: 'id, car_id',
      editRequests: 'id, car_id, requested_by, status',
      changeLog: 'id, table_name, record_id, operation, timestamp',
      notifications: 'id, user_id, is_read, created_at',
      syncQueue: 'id, change_log_id, table_name, synced, created_at',
    })
  }

  private autoSyncCallback: (() => void) | null = null

  setAutoSyncCallback(cb: () => void) {
    this.autoSyncCallback = cb
  }

  private triggerAutoSync() {
    if (this.autoSyncCallback) {
      this.autoSyncCallback()
    }
  }

  async repairDatabase() {
    try {
      await this.delete()
      await this.open()
    } catch (e) {
      console.error('repairDatabase failed:', e)
    }
  }

  // ── Sync Queue ────────────────────────────────────────────────

  async enqueueSync(entry: Omit<SyncQueueEntry, 'id' | 'synced' | 'created_at'>) {
    try {
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      await this.syncQueue.add({ ...entry, id, synced: false, created_at: createdAt })
      this.triggerAutoSync()
      return id
    } catch (err) {
      console.error('enqueueSync failed:', err)
      await this.repairDatabase()
      return ''
    }
  }

  async getUnsyncedEntries(): Promise<SyncQueueEntry[]> {
    try {
      return await this.syncQueue.where({ synced: false }).toArray()
    } catch (err) {
      console.error('getUnsyncedEntries failed:', err)
      await this.repairDatabase()
      return []
    }
  }

  async markSynced(ids: string[]) {
    try {
      await this.syncQueue.bulkUpdate(ids.map(id => ({ key: id, changes: { synced: true } })))
    } catch (err) {
      console.error('markSynced failed:', err)
      await this.repairDatabase()
    }
  }

  async clearSynced() {
    try {
      await this.syncQueue.where({ synced: true }).delete()
    } catch (err) {
      console.error('clearSynced failed:', err)
      await this.repairDatabase()
    }
  }

  // ── Users ─────────────────────────────────────────────────────

  async addUser(user: User) {
    await this.users.add(user)
    const logId = await this.addChangeLog('users', user.id, 'insert', null, user)
    await this.enqueueSync({ change_log_id: logId, table_name: 'users', record_id: user.id, operation: 'insert' })
  }

  async updateUser(id: string, changes: Partial<User>) {
    const existing = await this.users.get(id)
    if (!existing) throw new Error(`User ${id} not found`)
    const updated = { ...existing, ...changes, updated_at: new Date().toISOString() }
    await this.users.put(updated)
    const logId = await this.addChangeLog('users', id, 'update', existing, updated)
    await this.enqueueSync({ change_log_id: logId, table_name: 'users', record_id: id, operation: 'update' })
  }

  async deleteUser(id: string) {
    const existing = await this.users.get(id)
    if (!existing) return
    await this.users.delete(id)
    const logId = await this.addChangeLog('users', id, 'delete', existing, null)
    await this.enqueueSync({ change_log_id: logId, table_name: 'users', record_id: id, operation: 'delete' })
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id)
  }

  async getUsers(): Promise<User[]> {
    return this.users.toArray()
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return this.users.where('role').equals(role).toArray()
  }

  async getActiveUsers(): Promise<User[]> {
    return this.users.where({ is_active: true }).toArray()
  }

  // ── Cars ──────────────────────────────────────────────────────

  async addCar(car: Car) {
    await this.cars.add(car)
    const logId = await this.addChangeLog('cars', car.id, 'insert', null, car)
    await this.enqueueSync({ change_log_id: logId, table_name: 'cars', record_id: car.id, operation: 'insert' })
  }

  async updateCar(id: string, changes: Partial<Car>) {
    const existing = await this.cars.get(id)
    if (!existing) throw new Error(`Car ${id} not found`)
    const updated = { ...existing, ...changes, updated_at: new Date().toISOString() }
    await this.cars.put(updated)
    const logId = await this.addChangeLog('cars', id, 'update', existing, updated)
    await this.enqueueSync({ change_log_id: logId, table_name: 'cars', record_id: id, operation: 'update' })
  }

  async deleteCar(id: string) {
    const existing = await this.cars.get(id)
    if (!existing) return
    await this.carImages.where('car_id').equals(id).delete()
    await this.carFees.where('car_id').equals(id).delete()
    await this.carStages.where('car_id').equals(id).delete()
    await this.customers.where('car_id').equals(id).delete()
    await this.editRequests.where('car_id').equals(id).delete()
    await this.cars.delete(id)
    const logId = await this.addChangeLog('cars', id, 'delete', existing, null)
    await this.enqueueSync({ change_log_id: logId, table_name: 'cars', record_id: id, operation: 'delete' })
  }

  async getCar(id: string): Promise<Car | undefined> {
    return this.cars.get(id)
  }

  async getCars(): Promise<Car[]> {
    return this.cars.orderBy('updated_at').reverse().toArray()
  }

  async getCarsByStage(stage: string): Promise<Car[]> {
    return this.cars.where('current_stage').equals(stage).toArray()
  }

  async getCarsByCreator(userId: string): Promise<Car[]> {
    return this.cars.where('created_by').equals(userId).toArray()
  }

  async getPendingCars(): Promise<Car[]> {
    return this.cars.where({ has_pending_edit: true }).toArray()
  }

  async getConfirmedCars(): Promise<Car[]> {
    return this.cars.where({ confirmed: true }).toArray()
  }

  // ── Car Images ────────────────────────────────────────────────

  async addCarImage(image: CarImage) {
    await this.carImages.add(image)
    const logId = await this.addChangeLog('car_images', image.id, 'insert', null, image)
    await this.enqueueSync({ change_log_id: logId, table_name: 'car_images', record_id: image.id, operation: 'insert' })
  }

  async deleteCarImage(id: string) {
    const existing = await this.carImages.get(id)
    if (!existing) return
    await this.carImages.delete(id)
    const logId = await this.addChangeLog('car_images', id, 'delete', existing, null)
    await this.enqueueSync({ change_log_id: logId, table_name: 'car_images', record_id: id, operation: 'delete' })
  }

  async getCarImages(carId: string): Promise<CarImage[]> {
    return this.carImages.where('car_id').equals(carId).sortBy('order_index')
  }

  async reorderCarImages(carId: string, orderedIds: string[]) {
    const images = await this.getCarImages(carId)
    const updates = images.map(img => {
      const idx = orderedIds.indexOf(img.id)
      if (idx !== -1 && img.order_index !== idx) {
        return this.carImages.put({ ...img, order_index: idx })
      }
      return Promise.resolve()
    })
    await Promise.all(updates)
  }

  // ── Car Fees ──────────────────────────────────────────────────

  async setCarFees(fees: CarFees) {
    const existing = await this.carFees.where('car_id').equals(fees.car_id).first()
    if (existing) {
      const updated = { ...existing, ...fees, updated_at: new Date().toISOString() }
      await this.carFees.put(updated)
      const logId = await this.addChangeLog('car_fees', existing.id, 'update', existing, updated)
      await this.enqueueSync({ change_log_id: logId, table_name: 'car_fees', record_id: existing.id, operation: 'update' })
    } else {
      await this.carFees.add(fees)
      const logId = await this.addChangeLog('car_fees', fees.id, 'insert', null, fees)
      await this.enqueueSync({ change_log_id: logId, table_name: 'car_fees', record_id: fees.id, operation: 'insert' })
    }
  }

  async getCarFees(carId: string): Promise<CarFees | undefined> {
    return this.carFees.where('car_id').equals(carId).first()
  }

  // ── Car Stage Log ─────────────────────────────────────────────

  async addCarStageLog(log: CarStageLog) {
    await this.carStages.add(log)
    const logId = await this.addChangeLog('car_stages', log.id, 'insert', null, log)
    await this.enqueueSync({ change_log_id: logId, table_name: 'car_stages', record_id: log.id, operation: 'insert' })
  }

  async getCarStageLogs(carId: string): Promise<CarStageLog[]> {
    return this.carStages.where('car_id').equals(carId).reverse().sortBy('created_at')
  }

  async getLatestCarStage(carId: string): Promise<CarStageLog | undefined> {
    const logs = await this.getCarStageLogs(carId)
    return logs[logs.length - 1]
  }

  // ── Customers ─────────────────────────────────────────────────

  async addCustomer(customer: Customer) {
    await this.customers.add(customer)
    const logId = await this.addChangeLog('customers', customer.id, 'insert', null, customer)
    await this.enqueueSync({ change_log_id: logId, table_name: 'customers', record_id: customer.id, operation: 'insert' })
  }

  async updateCustomer(id: string, changes: Partial<Customer>) {
    const existing = await this.customers.get(id)
    if (!existing) throw new Error(`Customer ${id} not found`)
    const updated = { ...existing, ...changes, updated_at: new Date().toISOString() }
    await this.customers.put(updated)
    const logId = await this.addChangeLog('customers', id, 'update', existing, updated)
    await this.enqueueSync({ change_log_id: logId, table_name: 'customers', record_id: id, operation: 'update' })
  }

  async getCustomerByCar(carId: string): Promise<Customer | undefined> {
    return this.customers.where('car_id').equals(carId).first()
  }

  // ── Edit Requests ─────────────────────────────────────────────

  async addEditRequest(request: EditRequest) {
    await this.editRequests.add(request)
    const logId = await this.addChangeLog('edit_requests', request.id, 'insert', null, request)
    await this.enqueueSync({ change_log_id: logId, table_name: 'edit_requests', record_id: request.id, operation: 'insert' })
  }

  async updateEditRequest(id: string, changes: Partial<EditRequest>) {
    const existing = await this.editRequests.get(id)
    if (!existing) throw new Error(`EditRequest ${id} not found`)
    const updated = { ...existing, ...changes, reviewed_at: changes.status && changes.status !== existing.status ? new Date().toISOString() : existing.reviewed_at }
    await this.editRequests.put(updated)
    const logId = await this.addChangeLog('edit_requests', id, 'update', existing, updated)
    await this.enqueueSync({ change_log_id: logId, table_name: 'edit_requests', record_id: id, operation: 'update' })
  }

  async getEditRequestsByCar(carId: string): Promise<EditRequest[]> {
    return this.editRequests.where('car_id').equals(carId).reverse().sortBy('created_at')
  }

  async getPendingEditRequests(): Promise<EditRequest[]> {
    return this.editRequests.where('status').equals('pending').toArray()
  }

  async getEditRequestsByUser(userId: string): Promise<EditRequest[]> {
    return this.editRequests.where('requested_by').equals(userId).toArray()
  }

  // ── Change Log ────────────────────────────────────────────────

  private async addChangeLog(
    tableName: string,
    recordId: string,
    operation: 'insert' | 'update' | 'delete',
    oldData: unknown | null,
    newData: unknown | null,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const d = (newData || oldData || {}) as any
    const userId = d.updated_by || d.created_by || d.user_id || d.moved_by || d.requested_by || d.reviewed_by || ''
    const entry: ChangeLog = {
      id,
      table_name: tableName,
      record_id: recordId,
      operation,
      old_data: oldData,
      new_data: newData,
      user_id: userId,
      timestamp: new Date().toISOString(),
    }
    await this.changeLog.add(entry)
    return id
  }

  async getChangeLog(tableName?: string): Promise<ChangeLog[]> {
    if (tableName) {
      return this.changeLog.where('table_name').equals(tableName).reverse().sortBy('timestamp')
    }
    return this.changeLog.orderBy('timestamp').reverse().toArray()
  }

  // ── Notifications ─────────────────────────────────────────────

  async addNotification(notification: Notification) {
    await this.notifications.add(notification)
    const logId = await this.addChangeLog('notifications', notification.id, 'insert', null, notification)
    await this.enqueueSync({ change_log_id: logId, table_name: 'notifications', record_id: notification.id, operation: 'insert' })
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.where('user_id').equals(userId).reverse().sortBy('created_at')
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return this.notifications.where({ user_id: userId, is_read: false }).toArray()
  }

  async markNotificationRead(id: string) {
    const existing = await this.notifications.get(id)
    if (existing) {
      await this.notifications.put({ ...existing, is_read: true })
    }
  }

  async markAllNotificationsRead(userId: string) {
    const unread = await this.getUnreadNotifications(userId)
    await Promise.all(unread.map(n => this.notifications.put({ ...n, is_read: true })))
  }

  // ── Bulk upsert from sync ─────────────────────────────────────

  async upsertCars(cars: Car[]) {
    await this.cars.bulkPut(cars)
  }

  async upsertCarImages(images: CarImage[]) {
    await this.carImages.bulkPut(images)
  }

  async upsertCarFees(feesList: CarFees[]) {
    await this.carFees.bulkPut(feesList)
  }

  async upsertCarStages(stages: CarStageLog[]) {
    await this.carStages.bulkPut(stages)
  }

  async upsertCustomers(customers: Customer[]) {
    await this.customers.bulkPut(customers)
  }

  async upsertEditRequests(requests: EditRequest[]) {
    await this.editRequests.bulkPut(requests)
  }

  async upsertNotifications(notifications: Notification[]) {
    await this.notifications.bulkPut(notifications)
  }

  async upsertUsers(users: User[]) {
    await this.users.bulkPut(users)
  }
}

export const localDB = new LocalDB()
