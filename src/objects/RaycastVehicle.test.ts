import { Body } from './Body'
import { RaycastVehicle } from './RaycastVehicle'
import { Vec3 } from '../math/Vec3'
import { World } from '../world/World'

function suspensionWheel(vehicle: RaycastVehicle, normal: Vec3) {
  const index = vehicle.addWheel({
    directionLocal: new Vec3(0, -1, 0),
    suspensionStiffness: 30,
    suspensionRestLength: 0.4,
    dampingCompression: 0,
    dampingRelaxation: 0,
  })
  const wheel = vehicle.wheelInfos[index]
  wheel.isInContact = true
  wheel.suspensionLength = 0.2
  wheel.clippedInvContactDotSuspension = 1
  wheel.suspensionRelativeVelocity = 0
  wheel.directionWorld.set(0, -1, 0)
  wheel.raycastResult.hitNormalWorld.copy(normal)
  return wheel
}

describe('RaycastVehicle world lifecycle', () => {
  test('keeps the user callback, avoids duplicate attachment and supports reattachment', () => {
    const world = new World({ gravity: new Vec3(0, -9.81, 0) })
    const chassisBody = new Body({ mass: 150 })
    const vehicle = new RaycastVehicle({ chassisBody })
    const callback = jest.fn()
    vehicle.preStepCallback = callback

    vehicle.addToWorld(world)
    vehicle.addToWorld(world)
    expect(world.bodies).toEqual([chassisBody])
    world.step(1 / 120)
    expect(callback).toHaveBeenCalledTimes(1)

    vehicle.removeFromWorld(world)
    expect(vehicle.world).toBeNull()
    expect(world.bodies).toHaveLength(0)
    world.step(1 / 120)
    expect(callback).toHaveBeenCalledTimes(1)

    vehicle.addToWorld(world)
    world.step(1 / 120)
    expect(callback).toHaveBeenCalledTimes(2)
    expect(world.bodies).toEqual([chassisBody])
  })

  test('rejects attachment to a second world before leaking a listener', () => {
    const first = new World()
    const second = new World()
    const vehicle = new RaycastVehicle({ chassisBody: new Body({ mass: 150 }) })
    vehicle.addToWorld(first)

    expect(() => vehicle.addToWorld(second)).toThrow('already attached')
    expect(vehicle.world).toBe(first)
    expect(second.bodies).toHaveLength(0)
  })

  test('restores chassis collision response when the raycast fails', () => {
    const chassisBody = new Body({ mass: 150 })
    const vehicle = new RaycastVehicle({ chassisBody })
    const index = vehicle.addWheel()
    vehicle.world = {
      raycastClosest: () => {
        throw new Error('raycast failure')
      },
    } as unknown as World

    expect(() => vehicle.castRay(vehicle.wheelInfos[index])).toThrow('raycast failure')
    expect(chassisBody.collisionResponse).toBe(true)
  })
})

describe('RaycastVehicle pure longitudinal slip', () => {
  test('caps forward impulse even when lateral impulse is exactly zero', () => {
    const chassisBody = new Body({ mass: 150 })
    const groundBody = new Body({ mass: 0 })
    const vehicle = new RaycastVehicle({ chassisBody })
    const index = vehicle.addWheel({ frictionSlip: 1 })
    const wheel = vehicle.wheelInfos[index]
    const dt = 1 / 120
    wheel.raycastResult.body = groundBody
    wheel.suspensionForce = 1000
    wheel.engineForce = 10000

    vehicle.updateFriction(dt)

    const cap = Math.abs(wheel.suspensionForce * dt * wheel.frictionSlip)
    expect(Math.abs(wheel.sideImpulse)).toBe(0)
    expect(wheel.skidInfo).toBeLessThan(1)
    expect(Math.abs(wheel.forwardImpulse)).toBeLessThanOrEqual(cap + 1e-9)
  })
})

describe('RaycastVehicle suspension contact projection', () => {
  test('leaves flat-ground spring force unchanged', () => {
    const vehicle = new RaycastVehicle({ chassisBody: new Body({ mass: 150 }) })
    const wheel = suspensionWheel(vehicle, new Vec3(0, 1, 0))

    vehicle.updateSuspension(1 / 120)

    // Existing RaycastVehicle spring convention: 30 * 0.2 * 150.
    expect(wheel.suspensionForce).toBeCloseTo(900, 10)
    expect(wheel.directionWorld.toArray()).toEqual([0, -1, 0])
  })

  test('removes inverse-projection amplification on a vertical contact plane', () => {
    const vehicle = new RaycastVehicle({ chassisBody: new Body({ mass: 150 }) })
    const wheel = suspensionWheel(vehicle, new Vec3(1, 0, 0))
    wheel.clippedInvContactDotSuspension = 10

    vehicle.updateSuspension(1 / 120)

    expect(wheel.suspensionForce).toBe(0)
    expect(wheel.directionWorld.toArray()).toEqual([0, -1, 0])
  })

  test('does not pull the chassis toward an opposing contact normal', () => {
    const vehicle = new RaycastVehicle({ chassisBody: new Body({ mass: 150 }) })
    const wheel = suspensionWheel(vehicle, new Vec3(0, -1, 0))

    vehicle.updateSuspension(1 / 120)

    expect(wheel.suspensionForce).toBe(0)
  })
})
