# Exam mode

The laboratory can be used to give timed exams in a room of laptops that have no internet access.
The teacher's laptop hands the exam to the students' laptops over a local Wi-Fi network and takes
their answers back. Nothing leaves the room.

## Two editions

| Edition | Installed on | Contains |
| --- | --- | --- |
| **Teacher** (`Virtual Optics Lab Teacher`) | the teacher's laptop | free laboratory, writing exams, the classroom, marking, records |
| **Student** (`Virtual Optics Lab Student`) | every student laptop | free laboratory, joining an exam, sitting an exam file |

The student edition is built without the exam-writing and marking code, and no answer key is ever
sent to it.

## What is needed in the room

- A Wi-Fi router. It does not need an internet connection or any cable to the laptops; it only
  has to let the laptops reach each other. Any basic home router handles forty laptops.
- Every laptop, including the teacher's, connected to that router's Wi-Fi.
- On the **teacher's laptop only**: the first time a classroom is opened, Windows Firewall asks
  whether to allow the application on the network. Choose **Allow**, with both *Private* and
  *Public* networks ticked (Windows usually classes an unknown router as Public). If this was
  declined, allow *Virtual Optics Lab Teacher* under *Windows Security → Firewall → Allow an app
  through firewall*.
- On the router, "AP isolation" / "client isolation" must be **off** (it is off by default on most
  routers). When it is on, laptops cannot see each other and no classroom is found.

The student laptops need no firewall change: they only send requests to the teacher's laptop.

## Setting up a laptop (once)

*Settings* on the start screen holds what is set once per laptop and then left alone; students do
not need it.

On the **teacher's laptop**, *Your name* is what the students see beside the classroom (for
example `Dr. Hassan`). Without one they see the computer's name. Nothing else is set there: the
laptop's address is found by itself each time a classroom is opened.

On a **student laptop**, *Classroom connection* has two choices:

- **Find the classroom automatically** (the default): the laptop searches the lab network for any
  teacher's computer. Nothing is set up, and it works for every teacher.
- **Use saved teachers' computers**: for a network where the search finds nothing. While a
  classroom is open on the teacher's laptop, press *Find teachers on this network*; each teacher
  found is listed by name, and *Save this teacher* keeps that computer on the laptop. Several
  teachers can be saved, and the one with a classroom open is the one that appears when joining.
  An address can also be typed (it is shown on the teacher's classroom screen). A saved computer is
  remembered by its address, so give each teacher's laptop a fixed address on the router.

*Connection check* on the same page shows, while a classroom is open, whether the laptop reaches
it with the saved setting.

## Giving an exam

1. **Write it** (*Exams — teacher → New exam*): title, exam time in minutes, and questions.
   - *Written*: free text. A model answer can be stored for marking.
   - *Multiple choice*: two to eight choices, one correct.
   - *Laboratory bench*: the student works on the virtual bench. Press *Set up the bench…* to
     arrange the apparatus the student starts with, and list the values the student must report.
     A value with an accepted value and tolerance is checked automatically.
   - Written and multiple-choice questions can also be typed in Excel and imported from CSV
     (*CSV template* gives the column layout).
2. **Open a classroom** for the exam and give the sitting a name (for example the group).
3. **Students join**: on each laptop *Join an exam*, enter name and class and press *Join the
   exam*. The open classroom is found by itself and shown with the teacher's name; a choice
   appears only when several classrooms are open on the same network.
4. **Start the exam** when everyone is in. The clock starts for everyone at that moment and all
   laptops count down to the same deadline. Late arrivals get the remaining time.
5. While it runs the teacher sees who is working and who has submitted, can add 5 minutes for
   everyone, or end the exam early.
6. **Submitting**: a student submits when done and may withdraw the submission to change answers
   as long as time remains. When the time runs out, whatever is written is collected.
7. **Mark**: submitted students appear under *Submitted — ready to mark*. Multiple-choice and
   checked bench values are marked automatically; the teacher marks the rest and can override any
   automatic mark and add a comment. *View the student's bench* shows the apparatus as the student
   left it, with all calculated values visible.

### On a bench question the student cannot reveal the theory

The bench of an exam question is locked to experiment mode: calculated results show as *to be
measured*, *Reveal theory*, ray diagrams and the experiment guide are unavailable, and with *Hide
the unknowns…* ticked a lens reads `f = ?`, the interferometer's laser reads `λ = ?`, and an eye
becomes an *unknown eye*: its length, its cornea (both radii, their direction and the shape of the
surfaces) and its age are not shown and cannot be changed, and it is drawn with the standard
dimensions, without the meridians in the front view, so that they cannot be measured off the
picture. Whether the eye has chromatic aberration and whether real rays are traced is part of the
question's bench: the student cannot switch either. The student
finds its far point, near point or glasses from the image. Glasses come in steps of 0.25 D, so
accept a refractive error within about ±0.3 D. The lab notebook, which evaluates the
experiment's formula from the readings, is available only if the teacher allows it for that
question. The values a student can read are the ones a real bench offers: rail positions, the
screen graticule, the ruler and the protractor.

## Records and exports

Everything is stored on the teacher's laptop (*Sittings & marking → Open the records folder*); copy
that folder to back it up.

- **Sittings & marking** lists every sitting with its answers and marks.
- **Students** shows each student's history across sittings (matched by name and class).
- From a sitting: results as **CSV** (opens in Excel) or **PDF**, and every marked answer sheet as
  a PDF in a folder of your choice.
- From the exam list: the question paper and the answer key as PDF.
- A student can save a PDF copy of their own answers after submitting.

## If something goes wrong during an exam

| What happened | What the application does |
| --- | --- |
| A student laptop loses Wi-Fi | The student keeps working; answers are kept on the laptop and sent when the connection returns. |
| A student laptop restarts or the application is closed | Reopening it returns straight to the exam with the answers and the same deadline. |
| The teacher's application is closed or the laptop restarts | Students keep working. Reopen the sitting from *Sittings & marking* and press *Resume the classroom*. If the time ran out meanwhile, *Collect from the laptops* takes in what they kept. |

Answers are saved to the teacher's laptop a second or two after each change, so at most the last
few seconds of typing depend on the student's laptop staying on.

## Exam files

| Extension | Content | Opened by |
| --- | --- | --- |
| `.opticsmaster` | an exam with its answer key | teacher edition |
| `.opticsexam` | the same exam without the answer key | student edition |
| `.opticsanswers` | one student's answers | teacher edition |

The classroom needs none of these: they are for keeping an exam, moving it to another teacher's
laptop, and for sitting an exam **without a network**. A student opens a `.opticsexam` file
(double-click, or *Open an exam file*), the clock starts on that laptop, and at the end the
student saves a `.opticsanswers` file that the teacher imports (*Collect answer files* on the
exam, then *Import answers file…*). Without the classroom the teacher's laptop cannot enforce the
time; the file records when the student started and submitted.

With the portable exe, open these files from inside the application (*Open an exam file*,
*Import exam file…*). Double-clicking them works only when the application was installed with the
installer build (`npm run dist:win:setup`), which registers the file types.

## Limits

- Students are identified by the name and class they type and by their laptop; there are no
  passwords. Two students who type the same name and class appear as one person in *Students*.
- The student edition does not lock down Windows: a student can still switch to another program.
  Supervise the room as for a paper exam.
- The bench set-up of a question travels to the student laptop in full, because the laboratory
  needs it to calculate what the screen shows. A hidden focal length, laser line or eye is hidden
  on screen, not encrypted.
- Clocks are taken from the teacher's laptop; a wrong clock on a student laptop does not matter.

## For developers

```text
src/exam/                  pure TypeScript: documents, marking, CSV, printable HTML, the sitting
src/platform/desktop.ts    the desktop shell as the page sees it
src/components/exam/       screens (admin/ is a separate chunk left out of the student build)
electron/classroom.cjs     the sitting's rules, the HTTP interface and the classroom search
electron/storage.cjs       JSON records on the teacher's machine
electron/preload.cjs       the only bridge between page and shell
```

The classroom listens on TCP 47800 (HTTP + JSON) and answers the students' search on UDP 47801.
*Find teachers on this network* also asks every address that shares the laptop's first three
numbers (`GET /api/room` on TCP 47800), so it finds a classroom on a network that drops broadcasts
but not one that had to take another port.
Teacher actions exist only as calls from the teacher's own window; none is reachable over the
network. `npm run desktop` runs the teacher edition from source and `npm run desktop:student` the
student edition; two instances on one machine find each other, which is how the flow is tested.
