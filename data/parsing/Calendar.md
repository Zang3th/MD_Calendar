# Calendar

## January 2026

### 01.01.2026
- [x] New Year's walk

## November 2026

### 12.11.2026
- [ ] Sort tax documents
- [ ] 09:30 - 10:15 Dentist #Private
  - Location: Dr. Example's practice
  - Bring the bonus booklet
- [x] 14:00 Hairdresser
- [ ] Gift for Lena: book "Momo" & card #Private
  - First note line
  - Second note line

### 20.11.2026
- [ ] Pack the suitcase

## December 2026

### 28.12.2026
- [ ] Pick up the skis
This line is not understood by the parser and is preserved

## January 2027

### 04.01.2027
- [ ] Return the skis

## Multi-day

### Vacation #Private
#Start
- 20.11.2026
#End
- 24.11.2026

### Trade fair #Work
#Start
- 20.11.2026
#End
- 21.11.2026
#Location
- Koelnmesse
#Note
Booth B12.

### Training
#Start
- 30.11.2026
#End
- 02.12.2026

### Ski trip #Private
#Start
- 28.12.2026
#End
- 03.01.2027

## Recurring

### Pay rent
#Start
- 15.01.2026
#Repeat
- FREQ=MONTHLY;BYMONTHDAY=15

### Month-end closing
#Start
- 30.01.2026
#Repeat
- FREQ=MONTHLY;BYDAY=-1FR;UNTIL=20261231

### Car inspection #Car
#Start
- 10.03.2026
#Repeat
- FREQ=YEARLY;INTERVAL=2

### Vitamins
#Start
- 01.11.2026 08:00
#Repeat
- FREQ=DAILY

### Gym #Private
#Start
- 03.11.2026 18:30 - 20:00
#Repeat
- FREQ=WEEKLY;BYDAY=TU,TH

### Sprint review #Work
#Start
- 16.11.2026 14:00 - 15:00
#Repeat
- FREQ=WEEKLY;INTERVAL=2;BYDAY=MO
#Except
- 28.12.2026
#Done
- 16.11.2026
- 30.11.2026
#Location
- Meeting room 2
#Note
Demo the new calendar.
Collect feedback.
