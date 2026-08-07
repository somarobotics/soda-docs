# Integration & Handover Documentation

The integration contracts (ZMQ device plane, policy server wire format, headless
deployment) and the physical-model handover (URDF, dynamics, calibration
internals) are **not published on this site**. They ship with every unit, always
matching the software it runs:

- On the robot: `/opt/app/docs/customer/` inside the backend container
  (`docker cp robot-backend-1:/opt/app/docs/customer ./` to extract).
- Or ask your vendor for the integration documentation pack.
