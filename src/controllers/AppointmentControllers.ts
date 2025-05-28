import type { Request, Response } from "express";
import Appointment from "../models/Appointment";
import Branch from "../models/Branch";
import { appointmentStatus } from "../models/AppointmentStatus";
import { userRole } from "../models/RoleUser";

export class AppointmentControllers {
  static createAppointment = async (req: Request, res: Response) => {
    const { branchId } = req.params;
    try {
      const branch = await Branch.findById(branchId).populate("barbers");
      if (!branch) {
        const error = new Error("Local no encontrado");
        return res.status(404).json({ error: error.message });
      }
      const findAppointmnet = await Appointment.findOne({
        branchId: branch._id,
        day: req.body.day,
        barberId: req.body.barberId,
        timeSlot: req.body.timeSlot,
      });

      if (findAppointmnet) {
        const error = new Error("Turno no disponible en este horario");
        return res.status(409).json({ error: error.message });
      }
      const appointment = new Appointment(req.body);
      appointment.branchId = branch.id;
      appointment.barberId = req.body.barberId;
      appointment.status = "booked";

      await appointment.save();
      res.send("Turno creado correctamente");
    } catch (error) {
      res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static getTodayAppointment = async (req: Request, res: Response) => {
    const { branchId } = req.params;
    try {
      const branch = await Branch.findById(branchId).populate("barbers");
      if (!branch) {
        const error = new Error("Local no encontrado");
        return res.status(404).json({ error: error.message });
      }

      const today = new Date();
      const todayString = today.toISOString().split("T")[0];

      const appointments = await Appointment.find({
        branchId: branch._id,
        day: todayString,
      });

      if (!appointments.length) {
        return res.status(200).json({ branch, appointments: [] });
      }

      res.status(200).json({ branch, appointments });
    } catch (error) {
      res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static getAppointmentById = async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }
      res.status(200).json(appointment);
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static updateAppointment = async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }

      await Appointment.findByIdAndUpdate(appointmentId, req.body);
      res.status(200).json({ message: "Turno actualizado correctamente" });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static updateStatusAppointment = async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }

      if (
        req.user.role !== userRole.admin &&
        req.user.role !== userRole.barber 
      ) {
        const error = new Error("Acción no valida");
        return res.status(400).json({ error: error.message });
      }

      if (
        req.body.status !== appointmentStatus.completed &&
        req.body.status !== appointmentStatus.canceled
      ) {
        const error = new Error("Estado invalido");
        return res.status(400).json({ error: error.message });
      }
      if (
        appointment.status === req.body.status &&
        req.body.status === appointmentStatus.completed
      ) {
        const error = new Error("El turno ya se encuentra completado");
        return res.status(400).json({ error: error.message });
      }
      if (
        appointment.status === req.body.status &&
        req.body.status === appointmentStatus.canceled
      ) {
        const error = new Error("El turno ya se encuentra cancelado");
        return res.status(400).json({ error: error.message });
      }

      await Appointment.findByIdAndUpdate(appointmentId, {
        status: req.body.status,
      });
      return res
        .status(200)
        .json({ message: "Estado actualizado correctamente" });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static deleteAppointment = async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    try {
      if (
        req.user.role !== userRole.admin &&
        req.user.role !== userRole.barber
      ) {
        const error = new Error("Acción no valida");
        return res.status(400).json({ error: error.message });
      }

      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }
      await appointment.deleteOne();
      return res.status(200).json({ message: "Turno eliminado correctamente" });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };
  static getAppointmentByDay = async (req: Request, res: Response) => {
    const { appointmentDay, branchId } = req.params;
    try {
      const branch = await Branch.findById(branchId).populate("barbers");
      if (!branch) {
        const error = new Error("Local no encontrado");
        return res.status(404).json({ error: error.message });
      }

      const appointments = await Appointment.find({
        branchId: branch._id,
        day: appointmentDay,
      });
      if (!appointments) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }

      if (!appointments.length) {
        return res.status(200).json({ branch, appointments: [] });
      }

      res.status(200).json({ branch, appointments });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static getAppointmentByUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const appointments = await Appointment.find({ userId: userId })
        .populate({ path: "branchId", select: "name" })
        .populate({ path: "barberId", select: "name" });

      const nowDate = new Date();
      const nowDatePlus30 = new Date(nowDate.getTime() + 30 * 60000);
      const currentAppointment = [];
      const oldAppointment = [];
      for (const app of appointments) {
        // Combinar fecha y hora
        const fullDateStr = `${app.day}T${app.timeSlot}:00`; // ej: "2025-05-14T16:00:00"
        const appointmentDate = new Date(fullDateStr);

        // Comparar con "ahora + 30 minutos"
        if (appointmentDate >= nowDatePlus30 && app.status !== appointmentStatus.canceled && app.status !== appointmentStatus.completed) {
          currentAppointment.push(app);
        } else {
          oldAppointment.push(app);
        }
      }

      return res.status(200).json({ currentAppointment, oldAppointment });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  };

  static cancelAppointmetByUser = async (req: Request, res: Response) => {
    const { appointmentId } = req.params;
    try {
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        const error = new Error("Turno no encontrado");
        return res.status(404).json({ error: error.message });
      }

      if (appointment.status === appointmentStatus.canceled) {
        const error = new Error("El turno ya se encuentra cancelado");
        return res.status(400).json({ error: error.message });
      }

      if (appointment.status === appointmentStatus.completed) {
        const error = new Error("El turno ya se encuentra completado");
        return res.status(400).json({ error: error.message });
      }

      await Appointment.findByIdAndUpdate(appointmentId, {
        status: appointmentStatus.canceled,
      });
      return res
        .status(200)
        .json({ message: "Turno cancelado correctamente" });
    } catch (error) {
      return res.status(500).json({ error: "Hubo un error en el servidor" });
    }
  }
}
