import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AlClickOutsideDirective } from './click-outside.directive';

@Component({
  template: `
    <div id="outside-elem">Outside</div>
    <div id="target-elem" (alClickOutside)="onClickedOutside()">
      <span id="inside-elem">Inside</span>
    </div>
  `,
  imports: [AlClickOutsideDirective],
  standalone: true
})
class TestHostComponent {
  clickedOutsideCount = 0;
  onClickedOutside() {
    this.clickedOutsideCount++;
  }
}

describe('AlClickOutsideDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).createComponent(TestHostComponent);
    
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create host component and directive', () => {
    expect(component).toBeTruthy();
  });

  it('should NOT emit alClickOutside when clicking inside target element', () => {
    const insideElem = document.getElementById('inside-elem')!;
    insideElem.click();
    fixture.detectChanges();
    expect(component.clickedOutsideCount).toBe(0);
  });

  it('should emit alClickOutside when clicking outside target element', () => {
    const outsideElem = document.getElementById('outside-elem')!;
    outsideElem.click();
    fixture.detectChanges();
    expect(component.clickedOutsideCount).toBe(1);
  });
});
