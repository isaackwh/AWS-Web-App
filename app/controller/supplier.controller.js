const Supplier = require("../models/supplier.model.js");


const {body, validationResult} = require("express-validator");

const ExcelJS = require("exceljs");
const multer = require("multer");
const {parseCsv} = require("../utils/csv");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 1024 * 1024, files: 1}   // 1 MB
}).single("file");

const REQUIRED = ["name", "address", "city", "state", "email", "phone"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()\-]{7,20}$/;
const MAX_ROWS = 1000;
const MAX_SHOWN = 20;

exports.create = [

    // Validate and sanitize the name field.
    body('name', 'The student name is required').trim().isLength({min: 1}).escape(),
    body('address', 'The student address is required').trim().isLength({min: 1}).escape(),
    body('city', 'The student city is required').trim().isLength({min: 1}).escape(),
    body('state', 'The student state is required').trim().isLength({min: 1}).escape(),
    body('phone', 'Phone number should be 10 digit number plus optional country code').trim().isMobilePhone().escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a genre object with escaped and trimmed data.
        const supplier = new Supplier(req.body);

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('supplier-add', {title: 'Create Genre', supplier: supplier, errors: errors.array()});
        } else {
            // Data from form is valid., save to db
            Supplier.create(supplier, (err, data) => {
                if (err)
                    res.render("500", {message: `Error occurred while creating the Student.`});
                else res.redirect("/students");
            });
        }
    }
];

exports.findAll = (req, res) => {
    const perPage = 10;
    const requested = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const importedCount = parseInt(req.query.imported, 10);

    Supplier.count((err, total) => {
        if (err) {
            res.render("500", {message: "There was a problem retrieving the list of students"});
            return;
        }

        const totalPages = Math.max(Math.ceil(total / perPage), 1);
        const current = Math.min(requested, totalPages);
        const offset = (current - 1) * perPage;

        Supplier.getPage(perPage, offset, (err, data) => {
            if (err) {
                res.render("500", {message: "There was a problem retrieving the list of students"});
                return;
            }

            // Show at most 5 page numbers around the current page
            let first = Math.max(current - 2, 1);
            const last = Math.min(first + 4, totalPages);
            first = Math.max(last - 4, 1);

            const pages = [];
            for (let i = first; i <= last; i++) {
                pages.push({number: i, active: i === current});
            }

            res.render("supplier-list-all", {
                students: data,
                imported: importedCount > 0 ? importedCount : null,
                pagination: {
                    show: totalPages > 1,
                    pages: pages,
                    hasPrev: current > 1,
                    prev: current - 1,
                    hasNext: current < totalPages,
                    next: current + 1,
                    from: total === 0 ? 0 : offset + 1,
                    to: offset + data.length,
                    total: total
                }
            });
        });
    });
};

exports.findOne = (req, res) => {
    Supplier.findById(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === "not_found") {
                res.status(404).send({
                    message: `Not found Student with id ${req.params.id}.`
                });
            } else {
                res.render("500", {message: `Error retrieving student with id ${req.params.id}`});
            }
        } else res.render("supplier-update", {supplier: data});
    });
};


exports.update = [

    // Validate and sanitize the name field.
    body('name', 'The student name is required').trim().isLength({min: 1}).escape(),
    body('address', 'The student address is required').trim().isLength({min: 1}).escape(),
    body('city', 'The student city is required').trim().isLength({min: 1}).escape(),
    body('state', 'The student state is required').trim().isLength({min: 1}).escape(),
    body('phone', 'Phone number should be 10 digit number plus optional country code').trim().isMobilePhone().escape(),

    // Process request after validation and sanitization.
    (req, res, next) => {

        // Extract the validation errors from a request.
        const errors = validationResult(req);

        // Create a genre object with escaped and trimmed data.
        const supplier = new Supplier(req.body);
        supplier.i

        if (!errors.isEmpty()) {
            // There are errors. Render the form again with sanitized values/error messages.
            res.render('supplier-update', {supplier: supplier, errors: errors.array()});
        } else {
            // Data from form is valid., save to db
            Supplier.updateById(
                req.body.id,
                supplier,
                (err, data) => {
                    if (err) {
                        if (err.kind === "not_found") {
                            res.status(404).send({
                                message: `Student with id ${req.body.id} Not found.`
                            });
                        } else {
                            res.render("500", {message: `Error updating Student with id ${req.body.id}`});
                        }
                    } else res.redirect("/students");
                }
            );
        }
    }
];

exports.remove = (req, res) => {
    Supplier.delete(req.params.id, (err, data) => {
        if (err) {
            if (err.kind === "not_found") {
                res.status(404).send({
                    message: `Not found Student with id ${req.params.id}.`
                });
            } else {
                res.render("500", {message: `Could not delete Student with id ${req.body.id}`});
            }
        } else res.redirect("/students");
    });
};

exports.removeAll = (req, res) => {
    Supplier.removeAll((err, data) => {
        if (err)
            res.render("500", {message: `Some error occurred while removing all students.`});
        else res.send({message: `All students were deleted successfully!`});
    });
};

exports.removeMany = (req, res) => {
    let ids = req.body.ids || [];
    if (!Array.isArray(ids)) ids = [ids];   // a single checkbox arrives as a string
    ids = ids.map(Number).filter(id => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
        res.redirect("/students");
        return;
    }
    Supplier.removeMany(ids, (err, data) => {
        if (err)
            res.render("500", {message: "Error occurred while deleting the selected students."});
        else res.redirect("/students");
    });
};

function importError(res, errors, extra) {
    res.status(400).render("supplier-import", {hasErrors: true, errors: errors, extra: extra || null});
}

exports.downloadTemplate = (req, res) => {
    res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="students-template.csv"'
    });
    res.send("\uFEFFname,address,city,state,email,phone\r\n" +
        "Jane Doe,1 Main Street,Springfield,Illinois,jane@example.com,0123456789\r\n");
};

exports.importCsv = (req, res) => {
    upload(req, res, uploadErr => {
        if (uploadErr) {
            const msg = uploadErr.code === "LIMIT_FILE_SIZE"
                ? "The file is larger than 1 MB."
                : "The file could not be uploaded.";
            return importError(res, [msg]);
        }
        if (!req.file) return importError(res, ["Please choose a CSV file."]);

        const rows = parseCsv(req.file.buffer.toString("utf8"));
        if (rows.length === 0) return importError(res, ["The file is empty."]);

        // map column names (case-insensitive, any order) to positions
        const header = rows[0].map(h => h.trim().toLowerCase());
        const missing = REQUIRED.filter(c => header.indexOf(c) === -1);
        if (missing.length) {
            return importError(res, [`Missing column(s) in the first row: ${missing.join(", ")}`]);
        }
        const idx = {};
        REQUIRED.forEach(c => idx[c] = header.indexOf(c));

        const toInsert = [];
        const errors = [];
        for (let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if (r.every(v => v.trim() === "")) continue;   // skip blank lines

            const s = {};
            REQUIRED.forEach(c => s[c] = (r[idx[c]] || "").trim());

            const problems = [];
            REQUIRED.forEach(c => {
                if (!s[c]) problems.push(`${c} is empty`);
                else if (s[c].length > 255) problems.push(`${c} is too long`);
            });
            if (s.email && !EMAIL_RE.test(s.email)) problems.push("email is not valid");
            if (s.phone && !PHONE_RE.test(s.phone)) problems.push("phone is not valid");

            if (problems.length) errors.push(`Row ${i + 1}: ${problems.join(", ")}`);
            else toInsert.push(REQUIRED.map(c => s[c]));
        }

        if (errors.length) {
            return importError(res, errors.slice(0, MAX_SHOWN),
                errors.length > MAX_SHOWN ? errors.length - MAX_SHOWN : null);
        }
        if (toInsert.length === 0) return importError(res, ["The file has no student rows."]);
        if (toInsert.length > MAX_ROWS) {
            return importError(res, [`The file has ${toInsert.length} rows. The limit is ${MAX_ROWS} per import.`]);
        }

        Supplier.createMany(toInsert, (err, data) => {
            if (err)
                res.render("500", {message: "Error occurred while importing the students."});
            else res.redirect(`/students?imported=${toInsert.length}`);
        });
    });
};

exports.exportExcel = (req, res) => {
    Supplier.exportAll(async (err, data) => {
        if (err) {
            res.render("500", {message: "There was a problem exporting the list of students"});
            return;
        }
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "XYZ University";
            const sheet = workbook.addWorksheet("Students");
            sheet.columns = [
                {header: "Name", key: "name", width: 28},
                {header: "Address", key: "address", width: 36},
                {header: "City", key: "city", width: 18},
                {header: "State", key: "state", width: 18},
                {header: "Email", key: "email", width: 30},
                {header: "Phone", key: "phone", width: 16}
            ];
            data.forEach(s => sheet.addRow(s));

            const headerRow = sheet.getRow(1);
            headerRow.font = {bold: true, color: {argb: "FFFFFFFF"}};
            headerRow.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FF343A40"}};
            sheet.views = [{state: "frozen", ySplit: 1}];
            sheet.autoFilter = {from: "A1", to: "F1"};
            sheet.getColumn("phone").numFmt = "@";   // keep phone numbers as text (leading zeros)

            const stamp = new Date().toISOString().slice(0, 10);
            res.set({
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="students-${stamp}.xlsx"`
            });
            await workbook.xlsx.write(res);
            res.end();
        } catch (e) {
            console.log("export error: ", e);
            if (!res.headersSent) res.render("500", {message: "There was a problem creating the Excel file"});
            else res.end();
        }
    });
};
