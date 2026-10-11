package game

import (
	"testing"
)

func TestAreaScoringCountsStonesTerritoryAndKomi(t *testing.T) {
	// Black: 5 stones + 10 empty points = 15. White: 5 stones + 1 empty point + komi = 12.5.
	b := FromDiagram([]string{"..X.O", "..X.O", "..X.O", "..X.O", "..XO."})
	if black, white := territoryCounts(b, NewScratch(b.Len())); black != 10 || white != 1 {
		t.Fatalf("territory = %d, %d", black, white)
	}
	if Winner(b, NewScratch(b.Len())) != Black {
		t.Fatal("black should win")
	}
}

func TestKomiBreaksAnEqualAreaCount(t *testing.T) {
	// Each side has 5 stones and 5 empty points. The middle column belongs to nobody. White wins only because of komi.
	b := FromDiagram([]string{".X.O.", ".X.O.", ".X.O.", ".X.O.", ".X.O."})
	if black, white := territoryCounts(b, NewScratch(b.Len())); black != 5 || white != 5 {
		t.Fatalf("territory = %d, %d", black, white)
	}
	if Winner(b, NewScratch(b.Len())) != White {
		t.Fatal("white should win on komi")
	}
}

func TestSharedRegionIsNobodysTerritory(t *testing.T) {
	b := FromDiagram([]string{"X....", ".....", ".....", ".....", "....O"})
	if black, white := territoryCounts(b, NewScratch(b.Len())); black != 0 || white != 0 {
		t.Fatalf("territory = %d, %d", black, white)
	}
}

func TestSoleOwnerNeedsASingleColour(t *testing.T) {
	if soleOwner(Black) != Black || soleOwner(White) != White {
		t.Fatal("one colour on the border owns the region")
	}
	if soleOwner(Black|White) != Empty || soleOwner(Empty) != Empty {
		t.Fatal("a shared or open region has no owner")
	}
}
